import json
from uuid import uuid4

import httpx
import pytest

from architect import db


@pytest.mark.parametrize('failure', [None, 'storage', 'metadata', 'missing', 'wrong_key'])
def test_delete_scopes_ownership_and_can_retry_partial_failure(monkeypatch, failure):
    workspace, identifier = 'a' * 64, str(uuid4())
    calls = []
    key = f'{workspace}/{identifier}.json.gz'
    def handler(request):
        calls.append(request)
        if '/rest/v1/' in request.url.path:
            assert request.url.params['workspace_id'] == f'eq.{workspace}'
            assert request.url.params['id'] == f'eq.{identifier}'
            if request.method == 'GET':
                return httpx.Response(200, json=[] if failure == 'missing' else [
                    {'source_key': 'other-workspace/source' if failure == 'wrong_key' else key}])
            return httpx.Response(500 if failure == 'metadata' else 204)
        assert request.method == 'DELETE'
        assert request.url.path == '/storage/v1/object/architect-source'
        assert json.loads(request.content) == {'prefixes': [key]}
        # An empty result is valid on retry when the exact object is already gone.
        return httpx.Response(500 if failure == 'storage' else 200, json=[])
    monkeypatch.setenv('SUPABASE_URL', 'https://test.supabase.co')
    monkeypatch.setenv('SUPABASE_SECRET_KEY', 'sb_secret_test')
    original = httpx.Client
    monkeypatch.setattr(db.httpx, 'Client', lambda **kwargs: original(**kwargs, transport=httpx.MockTransport(handler)))
    if failure in ('storage', 'metadata'):
        with pytest.raises(httpx.HTTPError):
            db.delete(workspace, identifier)
    elif failure == 'wrong_key':
        with pytest.raises(ValueError):
            db.delete(workspace, identifier)
    else:
        assert db.delete(workspace, identifier) == (failure != 'missing')
    assert len(calls) == (1 if failure in ('missing', 'wrong_key') else 2 if failure == 'storage' else 3)


def test_delete_api_requires_boundary_uuid_and_workspace(client, monkeypatch):
    path = f'/api/projects/{uuid4()}'
    assert client.delete(path).status_code == 404
    assert client.delete(path, headers={'x-architect-secret':'wrong'}).status_code == 403
    assert client.delete('/api/projects/not-a-uuid').status_code == 422
    monkeypatch.setattr(db, 'configured', lambda: True)
    def delete(workspace, identifier):
        assert workspace == 'a' * 64 and path.endswith(identifier)
        return True
    monkeypatch.setattr(db, 'delete', delete)
    assert client.delete(path).json() == {'deleted': path.rsplit('/', 1)[1]}
    monkeypatch.setattr(db, 'delete', lambda *args: False)
    assert client.delete(path).json() == {'deleted': path.rsplit('/', 1)[1]}
    def fail(*args):
        raise httpx.ConnectError('internal-secret')
    monkeypatch.setattr(db, 'delete', fail)
    response = client.delete(path)
    assert response.status_code == 503 and 'internal-secret' not in response.text
