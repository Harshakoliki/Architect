import pytest
from fastapi.testclient import TestClient

from architect.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv('ARCHITECT_SERVICE_SECRET', 'test-service-secret')
    monkeypatch.delenv('SUPABASE_URL', raising=False)
    monkeypatch.delenv('SUPABASE_SECRET_KEY', raising=False)
    with TestClient(app, headers={'x-architect-secret': 'test-service-secret',
                                  'x-architect-workspace': 'a' * 64}) as client:
        yield client

