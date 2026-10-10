import copy
import json

import httpx2
import pytest
from fastapi.testclient import TestClient
from openai import OpenAI
from test_product import context

from architect import product
from architect.main import app
from architect.questions import Answer, QuestionRequest, answer_question, validate_answer


def request(question, **kwargs):
    bundle = context()
    sample = product.annotated_example(bundle, bundle)
    body = QuestionRequest(context=bundle, meaning={key: sample[key] for key in ("features", "gaps")},
                           question=question, **kwargs)
    return body, bundle, sample


def test_sample_flow_finder_and_uncertainty():
    for question, view, index in [("Show me everything involved when a customer uploads a document", "journeys", 0),
                                   ("Show document upload data", "data", 0),
                                   ("Show document fingerprinting", "data", 1)]:
        body, bundle, sample = request(question, example=True)
        result = answer_question(body, bundle, sample)
        assert result["status"] == "answered" and result["view"] == view
        assert result["feature_index"] == index and result["provider"] == "sample_finder"
        assert result["evidence_ids"] and "not a runtime trace" in result["answer"]
    for question, status in [("Show document", "ambiguous"), ("Why does upload fail?", "insufficient_evidence"),
                             ("Show billing", "insufficient_evidence")]:
        body, bundle, sample = request(question, example=True)
        result = answer_question(body, bundle, sample)
        assert result["status"] == status and result["feature_index"] is None


def test_answer_validation_rejects_invented_navigation_and_evidence():
    body, bundle, sample = request("Show upload", example=True)
    valid = answer_question(body, bundle, sample)
    valid.pop("provider")
    for changes in [{"feature_index": 42}, {"flow_index": 42}, {"evidence_ids": ["invented"]},
                    {"status": "ambiguous"}]:
        with pytest.raises(ValueError):
            validate_answer(Answer.model_validate({**valid, **changes}), sample, bundle)
    changed = copy.deepcopy(sample)
    changed["features"][0]["summary"] = "Forged sample claim"
    body.meaning = product.Meaning.model_validate({key: changed[key] for key in ("features", "gaps")})
    with pytest.raises(ValueError, match="unchanged annotated"):
        answer_question(body, bundle, sample)


def test_question_api_consent_limits_and_sample(monkeypatch):
    monkeypatch.setenv("ARCHITECT_SERVICE_SECRET", "test-secret")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    body, _, _ = request("Show upload")
    with TestClient(app, headers={"x-architect-secret": "test-secret", "x-architect-workspace": "a"*64}) as client:
        result = client.post("/api/ask", json=body.model_dump())
        assert result.status_code == 422 and "Confirm sending" in result.json()["detail"]
        body.consent = True
        assert "not configured" in client.post("/api/ask", json=body.model_dump()).json()["detail"]
        body.example = True
        assert client.post("/api/ask", json=body.model_dump()).json()["status"] == "answered"
        assert client.post("/api/ask", content=b"x"*128_001).status_code == 413
        assert client.post("/api/ask", json={}).status_code == 422


def test_openai_question_uses_real_sdk_schema_without_tools(monkeypatch):
    body, bundle, sample = request("Show upload", consent=True)
    output = {"status": "answered", "answer": "An inferred upload flow, subject to source review.",
              "feature_index": 0, "view": "journeys", "flow_index": 0,
              "evidence_ids": sample["features"][0]["evidence_ids"]}

    def respond(request):
        payload = json.loads(request.content)
        assert payload["store"] is False and "tools" not in payload
        assert payload["text"]["format"]["strict"] is True
        assert "UNTRUSTED DATA" in payload["instructions"]
        assert json.loads(payload["input"])["question"] == "Show upload"
        return httpx2.Response(200, json={"id": "resp_test", "object": "response", "created_at": 1,
            "status": "completed", "model": "gpt-6.1-sol", "output": [{"type": "message", "id": "msg_test",
            "role": "assistant", "status": "completed", "content": [{"type": "output_text", "text": json.dumps(output), "annotations": []}]}]})

    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-real-key")
    monkeypatch.setattr(product, "OpenAI", lambda **kwargs: OpenAI(**kwargs,
        http_client=httpx2.Client(transport=httpx2.MockTransport(respond))))
    result = answer_question(body, bundle)
    assert result["provider"] == "openai" and result["feature_index"] == 0
