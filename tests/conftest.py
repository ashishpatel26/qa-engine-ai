import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("QA_ENGINE_SERVE_STATIC", "0")

import server


@pytest.fixture(autouse=True)
def reset_backend_state(monkeypatch, tmp_path):
    monkeypatch.delenv("QA_ENGINE_DEMO_MODE", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.setattr(server, "TEST_RUN_HISTORY_PATH", tmp_path / "test_runs.json")
    monkeypatch.setattr(server, "SETTINGS_PATH", tmp_path / "settings.json")
    server._reset_state_for_tests()
    yield
    server._reset_state_for_tests()


@pytest.fixture
def client():
    return TestClient(server.app)
