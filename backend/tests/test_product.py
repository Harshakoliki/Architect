import copy
import json

import httpx2
import pytest
from fastapi.testclient import TestClient
from openai import OpenAI

from architect import product
from architect.analyzer import build_graph
from architect.main import SAMPLE, app
from architect.scanner import redact, scan


def context():
    files, _ = scan(SAMPLE)
    return product.make_context(files, {file['id']: redact(file['content']) for file in files},
                                build_graph(files))


def test_sample_context_and_annotated_flows_have_real_evidence():
    bundle = context()
    assert product.validate_context(product.Context.model_validate(bundle)) == bundle
    result = product.annotated_example(bundle, bundle)
    assert result['provider'] == 'annotated_sample'
    assert len(result['features']) == 2
    assert result['features'][0]['journeys'][0]['steps'][2]['title'] == 'Create an in-memory record'
    assert 'bytes in memory' in result['features'][0]['data_flows'][0]['steps'][2]['description']
    product.validate_meaning(product.Meaning.model_validate({key: result[key] for key in
                              ('features', 'gaps')}), bundle)
    assert any('SQL schema is not connected' in gap for gap in result['gaps'])


def test_context_bounds_redaction_and_excluded_input():
    files, _ = scan(SAMPLE)
    contents = {file['id']: ('api_key="never-send-this"\n' + file['content']) for file in files}
    bundle = product.make_context(files, contents, build_graph(files))
    assert 'never-send-this' not in json.dumps(bundle)
    assert len(bundle['snippets']) <= 12 and len(json.dumps(bundle).encode()) <= 48_000
    forged = copy.deepcopy(bundle)
    forged['snippets'][0]['path'] = '.env'
    with pytest.raises(ValueError, match='Excluded'):
        product.validate_context(product.Context.model_validate(forged))
    forged = copy.deepcopy(bundle)
    forged['snippets'][0]['end_line'] += 1
    with pytest.raises(ValueError, match='invalid'):
        product.validate_context(product.Context.model_validate(forged))


def test_invented_citations_and_connections_rejected():
    bundle = context()
    result = product.annotated_example(bundle, bundle)
    result = {key: result[key] for key in ('features', 'gaps')}
    forged = copy.deepcopy(result)
    forged['features'][0]['evidence_ids'] = ['invented-file']
    with pytest.raises(ValueError, match='unavailable evidence'):
        product.validate_meaning(product.Meaning.model_validate(forged), bundle)
    forged = copy.deepcopy(result)
    forged['features'][0]['journeys'][0]['transitions'][0]['target'] = 'invented-step'
    with pytest.raises(ValueError, match='unsupported connection'):
        product.validate_meaning(product.Meaning.model_validate(forged), bundle)


def test_real_sdk_request_contract_and_structured_parsing(monkeypatch):
    bundle = context()
    example = product.annotated_example(bundle, bundle)
    meaning = {key: example[key] for key in ('features', 'gaps')}
    requests = []

    def respond(request):
        body = json.loads(request.content)
        requests.append(body)
        assert body['store'] is False and body['max_output_tokens'] == 6000
        assert body['text']['format']['type'] == 'json_schema'
        assert body['text']['format']['strict'] is True
        assert 'tools' not in body and 'UNTRUSTED DATA' in body['instructions']
        return httpx2.Response(200, json={'id': 'resp_test', 'object': 'response',
            'created_at': 1, 'status': 'completed', 'model': 'gpt-6.1-sol',
            'output': [{'type': 'message', 'id': 'msg_test', 'role': 'assistant',
                        'status': 'completed', 'content': [{'type': 'output_text',
                        'text': json.dumps(meaning), 'annotations': []}]}],
            'usage': {'input_tokens': 100, 'output_tokens': 200, 'total_tokens': 300}})

    def client(**kwargs):
        assert kwargs['max_retries'] == 0 and kwargs['timeout'] == 45
        return OpenAI(**kwargs, http_client=httpx2.Client(transport=httpx2.MockTransport(respond)))

    monkeypatch.setenv('OPENAI_API_KEY', 'test-not-a-real-key')
    monkeypatch.setattr(product, 'OpenAI', client)
    result = product.interpret(bundle)
    assert result['provider'] == 'openai' and result['usage']['total_tokens'] == 300
    assert len(requests) == 1


def test_refusal_and_provider_failure_preserve_lock(monkeypatch):
    def refuse(request):
        return httpx2.Response(200, json={'id': 'resp_test', 'object': 'response',
            'created_at': 1, 'status': 'completed', 'model': 'gpt-6.1-sol',
            'output': [{'type': 'message', 'id': 'msg_test', 'role': 'assistant',
                        'status': 'completed', 'content': [{'type': 'refusal',
                        'refusal': 'Cannot interpret this source.'}]}]})

    monkeypatch.setenv('OPENAI_API_KEY', 'test-not-a-real-key')
    monkeypatch.setattr(product, 'OpenAI', lambda **kwargs: OpenAI(**kwargs,
        http_client=httpx2.Client(transport=httpx2.MockTransport(refuse))))
    with pytest.raises(ValueError, match='declined'):
        product.interpret(context())
    assert not product.IN_FLIGHT.locked()

    def reject(request):
        return httpx2.Response(401, json={'error': {'message': 'secret provider details',
                                                 'type': 'invalid_request_error'}})

    monkeypatch.setattr(product, 'OpenAI', lambda **kwargs: OpenAI(**kwargs,
        http_client=httpx2.Client(transport=httpx2.MockTransport(reject))))
    with pytest.raises(ValueError, match='request failed') as error:
        product.interpret(context())
    assert 'secret provider details' not in str(error.value)
    assert not product.IN_FLIGHT.locked()

    def malformed(request):
        return httpx2.Response(200, json={'id': 'resp_test', 'object': 'response',
            'created_at': 1, 'status': 'completed', 'model': 'gpt-6.1-sol',
            'output': [{'type': 'message', 'id': 'msg_test', 'role': 'assistant',
                        'status': 'completed', 'content': [{'type': 'output_text',
                        'text': 'not valid JSON', 'annotations': []}]}]})

    monkeypatch.setattr(product, 'OpenAI', lambda **kwargs: OpenAI(**kwargs,
        http_client=httpx2.Client(transport=httpx2.MockTransport(malformed))))
    with pytest.raises(ValueError, match='invalid result'):
        product.interpret(context())
    assert not product.IN_FLIGHT.locked()


def test_api_requires_consent_and_example_cannot_apply_to_other_source(monkeypatch):
    monkeypatch.setenv('ARCHITECT_SERVICE_SECRET', 'test-secret')
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    bundle = context()
    with TestClient(app, headers={'x-architect-secret': 'test-secret',
                                  'x-architect-workspace': 'a'*64}) as client:
        assert not client.get('/api/health').json()['ai_configured']
        result = client.post('/api/interpret', json={'context': bundle})
        assert result.status_code == 422 and 'Confirm sending' in result.json()['detail']
        result = client.post('/api/interpret', json={'context': bundle, 'consent': True})
        assert result.status_code == 422 and 'not configured' in result.json()['detail']
        assert client.post('/api/interpret', json={'context': bundle, 'example': True}).status_code == 200
        other = copy.deepcopy(bundle)
        other['total_files'] += 1
        result = client.post('/api/interpret', json={'context': other, 'example': True})
        assert result.status_code == 422 and 'unchanged bundled sample' in result.json()['detail']
        assert client.post('/api/interpret', content=b'x'*64_001).status_code == 413
