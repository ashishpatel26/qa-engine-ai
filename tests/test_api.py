import io
import json
import subprocess
import time
import urllib.error

import pytest

import server


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


def test_status_returns_backend_state(client):
    response = client.get("/api/status")

    assert response.status_code == 200
    data = response.json()
    assert data["fix_applied"] is False
    assert data["services_connected"]["OpenAI"] is False
    assert data["services_connected"]["Ollama"] is False


def test_non_secret_settings_persist_to_disk(client):
    response = client.post(
        "/api/settings",
        json={
            "sync_enabled": True,
            "openai_enabled": False,
            "anthropic_enabled": True,
            "ollama_host": "http://127.0.0.1:11434",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "sync_enabled": True,
        "openai_enabled": False,
        "anthropic_enabled": True,
        "ollama_host": "http://127.0.0.1:11434",
    }
    assert server.app_state["ollama_host"] == "http://127.0.0.1:11434"

    reloaded_settings = server._load_settings()
    assert reloaded_settings["sync_enabled"] is True
    assert reloaded_settings["openai_enabled"] is False
    assert reloaded_settings["anthropic_enabled"] is True
    assert reloaded_settings["ollama_host"] == "http://127.0.0.1:11434"


def test_connect_disconnect_validate_service_names(client):
    connect_response = client.post("/api/connect", json={"service": "Codex"})
    assert connect_response.status_code == 200
    assert server.app_state["services_connected"]["Codex"] is True

    invalid_connect = client.post("/api/connect", json={"service": "NotAService"})
    assert invalid_connect.status_code == 400
    assert "NotAService" not in server.app_state["services_connected"]

    disconnect_response = client.post("/api/disconnect", json={"service": "Codex"})
    assert disconnect_response.status_code == 200
    assert server.app_state["services_connected"]["Codex"] is False

    invalid_disconnect = client.post("/api/disconnect", json={"service": "NotAService"})
    assert invalid_disconnect.status_code == 400
    assert "NotAService" not in server.app_state["services_connected"]


def test_chat_fails_without_provider_in_production(client):
    response = client.post(
        "/api/chat",
        json={"message": "run tests", "model": "GPT-4o"},
    )

    assert response.status_code == 400
    assert "No chat provider configured" in response.json()["detail"]


def test_chat_demo_mode_keeps_canned_responses(client, monkeypatch):
    monkeypatch.setenv("QA_ENGINE_DEMO_MODE", "1")

    response = client.post(
        "/api/chat",
        json={"message": "run tests", "model": "GPT-4o"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["sender"] == "assistant"
    assert data["name"] == "QA Engine"
    assert data["provider"] == "demo"
    assert data["has_patch"] is False
    assert data["patch_proposals"] == []
    assert any("Jest" in line for line in data["logs"])


def test_chat_calls_openai_with_request_key_and_context(client, monkeypatch, tmp_path):
    workspace_file = tmp_path / "notes.txt"
    workspace_file.write_text("hello fixture", encoding="utf-8")
    monkeypatch.setattr(server, "PROJECT_ROOT", tmp_path.resolve())

    def fake_urlopen(request, timeout):
        assert request.full_url == server.OPENAI_CHAT_URL
        assert timeout == server.OPENAI_TIMEOUT_SECONDS
        assert request.get_header("Authorization") == "Bearer sk-test"
        payload = json.loads(request.data.decode("utf-8"))
        assert payload["model"] == "gpt-4o"
        assert payload["messages"][0]["role"] == "system"
        assert "hello fixture" in payload["messages"][0]["content"]
        assert payload["messages"][-1] == {"role": "user", "content": "Summarize it"}
        return FakeResponse({"choices": [{"message": {"content": "Model says hi"}}]})

    monkeypatch.setattr(server.urllib.request, "urlopen", fake_urlopen)

    response = client.post(
        "/api/chat",
        json={
            "message": "Summarize it",
            "model": "GPT-4o",
            "api_key": "sk-test",
            "context_files": ["notes.txt"],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "openai"
    assert data["model"] == "gpt-4o"
    assert data["content"] == "Model says hi"
    assert data["context_files"] == [{"path": "notes.txt", "size": len("hello fixture")}]
    assert data["has_patch"] is False


def test_chat_uses_openai_env_key(client, monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-env")

    def fake_urlopen(request, timeout):
        assert request.get_header("Authorization") == "Bearer sk-env"
        return FakeResponse({"choices": [{"message": {"content": "env response"}}]})

    monkeypatch.setattr(server.urllib.request, "urlopen", fake_urlopen)

    response = client.post("/api/chat", json={"message": "hello"})

    assert response.status_code == 200
    assert response.json()["content"] == "env response"


def test_chat_openai_errors_are_sanitized(client, monkeypatch):
    def fake_urlopen(*args, **kwargs):
        raise urllib.error.HTTPError(
            server.OPENAI_CHAT_URL,
            401,
            "Unauthorized",
            hdrs=None,
            fp=io.BytesIO(b'{"error":{"message":"secret provider detail"}}'),
        )

    monkeypatch.setattr(server.urllib.request, "urlopen", fake_urlopen)

    response = client.post(
        "/api/chat",
        json={"message": "hello", "api_key": "sk-test"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "OpenAI authentication failed. Check the API key."
    assert "secret provider detail" not in response.text


def test_chat_rejects_demo_provider_outside_demo_mode(client):
    response = client.post(
        "/api/chat",
        json={"message": "hello", "provider": "demo"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Demo chat requires QA_ENGINE_DEMO_MODE=true."


def test_workspace_file_listing_is_root_allowlisted(client, monkeypatch, tmp_path):
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "app.py").write_text("print('ok')", encoding="utf-8")
    (tmp_path / ".git").mkdir()
    (tmp_path / ".env").write_text("SECRET=1", encoding="utf-8")
    (tmp_path / ".gitignore").write_text("node_modules\n", encoding="utf-8")
    monkeypatch.setattr(server, "PROJECT_ROOT", tmp_path.resolve())

    response = client.get("/api/workspace/files", params={"path": "."})

    assert response.status_code == 200
    data = response.json()
    assert data["path"] == "."
    assert {"name": "src", "path": "src", "type": "directory"} in data["entries"]
    names = {entry["name"] for entry in data["entries"]}
    assert ".git" not in names
    assert ".env" not in names
    assert ".gitignore" in names

    escape = client.get("/api/workspace/files", params={"path": "../"})
    assert escape.status_code == 400
    assert escape.json()["detail"] == "Path is outside the workspace root."


def test_workspace_file_read_returns_utf8_text_with_size_guard(client, monkeypatch, tmp_path):
    text_file = tmp_path / "server.py"
    text_file.write_text("print('hello')", encoding="utf-8")
    large_file = tmp_path / "large.txt"
    large_file.write_text("0123456789", encoding="utf-8")
    binary_file = tmp_path / "binary.bin"
    binary_file.write_bytes(b"\xff\xfe\x00")

    monkeypatch.setattr(server, "PROJECT_ROOT", tmp_path.resolve())
    monkeypatch.setattr(server, "WORKSPACE_MAX_FILE_BYTES", 8)

    response = client.get("/api/workspace/file", params={"path": "server.py"})
    assert response.status_code == 400
    assert "byte read limit" in response.json()["detail"]

    monkeypatch.setattr(server, "WORKSPACE_MAX_FILE_BYTES", 32)
    response = client.get("/api/workspace/file", params={"path": "server.py"})
    assert response.status_code == 200
    assert response.json()["content"] == "print('hello')"
    assert response.json()["encoding"] == "utf-8"

    large_response = client.get("/api/workspace/file", params={"path": "large.txt"})
    assert large_response.status_code == 200

    monkeypatch.setattr(server, "WORKSPACE_MAX_FILE_BYTES", 128)
    binary_response = client.get("/api/workspace/file", params={"path": "binary.bin"})
    assert binary_response.status_code == 400
    assert binary_response.json()["detail"] == "Only UTF-8 text files can be read."


def test_workspace_file_read_rejects_escape_paths(client, monkeypatch, tmp_path):
    monkeypatch.setattr(server, "PROJECT_ROOT", tmp_path.resolve())

    response = client.get("/api/workspace/file", params={"path": "../../etc/passwd"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Path is outside the workspace root."


def test_patch_proposal_and_apply_are_checksum_validated(client, monkeypatch, tmp_path):
    target = tmp_path / "sample.py"
    target.write_text("value = 1\n", encoding="utf-8")
    monkeypatch.setattr(server, "PROJECT_ROOT", tmp_path.resolve())

    proposal_response = client.post(
        "/api/patch/proposals",
        json={
            "target_file": "sample.py",
            "find": "value = 1",
            "replace": "value = 2",
            "explanation": "Increment the sample value.",
        },
    )

    assert proposal_response.status_code == 200
    proposal = proposal_response.json()
    assert proposal["target_file"] == "sample.py"
    assert "-value = 1" in proposal["unified_diff"]
    assert "+value = 2" in proposal["unified_diff"]

    missing_confirmation = client.post(
        "/api/patch/apply",
        json={
            "target_file": proposal["target_file"],
            "original_checksum": proposal["original_checksum"],
            "replacement": proposal["replacement"],
        },
    )
    assert missing_confirmation.status_code == 400

    target.write_text("value = 3\n", encoding="utf-8")
    stale_apply = client.post(
        "/api/patch/apply",
        json={
            "target_file": proposal["target_file"],
            "original_checksum": proposal["original_checksum"],
            "replacement": proposal["replacement"],
            "confirm": True,
        },
    )
    assert stale_apply.status_code == 409

    target.write_text("value = 1\n", encoding="utf-8")
    apply_response = client.post(
        "/api/patch/apply",
        json={
            "target_file": proposal["target_file"],
            "original_checksum": proposal["original_checksum"],
            "replacement": proposal["replacement"],
            "confirm": True,
        },
    )
    assert apply_response.status_code == 200
    assert apply_response.json()["success"] is True
    assert target.read_text(encoding="utf-8") == "value = 2\n"


def test_legacy_apply_fix_is_demo_only(client, monkeypatch):
    response = client.post("/api/apply-fix")
    assert response.status_code == 400

    monkeypatch.setenv("QA_ENGINE_DEMO_MODE", "1")
    demo_response = client.post("/api/apply-fix")
    assert demo_response.status_code == 200
    assert demo_response.json()["success"] is True


def test_ollama_detect_reads_real_local_models(client, monkeypatch):
    def fake_urlopen(request, timeout):
        assert request.full_url == "http://localhost:11434/api/tags"
        assert timeout == 2.0
        return FakeResponse({"models": [{"name": "llama3.1:8b"}]})

    monkeypatch.setattr(server.urllib.request, "urlopen", fake_urlopen)

    response = client.post("/api/ollama/detect", json={"host": "localhost:11434"})

    assert response.status_code == 200
    assert response.json() == {"success": True, "models": ["llama3.1:8b"]}
    assert server.app_state["ollama_host"] == "http://localhost:11434"
    assert server.app_state["services_connected"]["Ollama"] is True


def test_ollama_localhost_failure_does_not_fake_success_by_default(client, monkeypatch):
    def failing_urlopen(*args, **kwargs):
        raise urllib.error.URLError("connection refused")

    monkeypatch.setattr(server.urllib.request, "urlopen", failing_urlopen)

    response = client.post("/api/ollama/detect", json={"host": "http://127.0.0.1:11434"})

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert "Could not connect to Ollama" in data["error"]
    assert server.app_state["services_connected"]["Ollama"] is False
    assert server.app_state["ollama_models"] == []


def test_ollama_demo_mode_is_required_for_fake_models(client, monkeypatch):
    def failing_urlopen(*args, **kwargs):
        raise urllib.error.URLError("connection refused")

    monkeypatch.setenv("QA_ENGINE_DEMO_MODE", "1")
    monkeypatch.setattr(server.urllib.request, "urlopen", failing_urlopen)

    response = client.post("/api/ollama/detect", json={"host": "http://localhost:11434"})

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["demo"] is True
    assert data["models"] == server.DEMO_OLLAMA_MODELS
    assert server.app_state["services_connected"]["Ollama"] is True


def test_ollama_rejects_non_local_hosts_without_probe(client, monkeypatch):
    calls = []

    def fake_urlopen(*args, **kwargs):
        calls.append((args, kwargs))
        return FakeResponse({"models": []})

    monkeypatch.setattr(server.urllib.request, "urlopen", fake_urlopen)

    response = client.post("/api/ollama/detect", json={"host": "http://example.com:11434"})

    assert response.status_code == 400
    assert response.json()["detail"] == "Only local Ollama hosts are allowed."
    assert calls == []


def test_ollama_rejects_localhost_subdomain_tricks(client):
    response = client.post(
        "/api/ollama/detect",
        json={"host": "http://localhost.example.com:11434"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Only local Ollama hosts are allowed."


def test_oauth_status_never_returns_private_session_fields(client):
    start_response = client.get("/api/oauth/codex/start")
    state_token = start_response.json()["state"]

    assert "code_verifier" in server.oauth_sessions[state_token]

    status_response = client.get(
        "/api/oauth/codex/status",
        params={"state_token": state_token},
    )

    assert status_response.status_code == 200
    data = status_response.json()
    assert set(data) == {"status", "service", "user"}
    assert data == {"status": "pending", "service": "codex", "user": None}


def test_oauth_callback_rejects_state_service_mismatch(client):
    start_response = client.get("/api/oauth/codex/start")
    state_token = start_response.json()["state"]

    callback_response = client.get(
        "/api/oauth/claude/callback",
        params={"code": "abc123", "state": state_token},
    )

    assert callback_response.status_code == 200
    assert "OAuth state does not match this service." in callback_response.text
    assert server.app_state["services_connected"]["Codex"] is False
    assert server.app_state["services_connected"]["ClaudeCode"] is False

    status_response = client.get(
        "/api/oauth/codex/status",
        params={"state_token": state_token},
    )
    assert status_response.json()["status"] == "error"


def test_expired_oauth_sessions_are_removed_before_polling(client):
    start_response = client.get("/api/oauth/codex/start")
    state_token = start_response.json()["state"]
    server.oauth_sessions[state_token]["expires_at"] = time.time() - 1

    status_response = client.get(
        "/api/oauth/codex/status",
        params={"state_token": state_token},
    )

    assert status_response.status_code == 200
    assert status_response.json() == {"status": "unknown", "service": "codex", "user": None}
    assert state_token not in server.oauth_sessions


@pytest.mark.parametrize(
    ("path", "api_key"),
    [
        ("/api/auth/codex", "sk-test"),
        ("/api/auth/claude", "sk-ant-test"),
    ],
)
def test_provider_auth_generic_exceptions_are_sanitized(client, monkeypatch, path, api_key):
    def failing_urlopen(*args, **kwargs):
        raise RuntimeError("internal secret detail should not leak")

    monkeypatch.setattr(server.urllib.request, "urlopen", failing_urlopen)

    response = client.post(path, json={"api_key": api_key})

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data["error"] == server.GENERIC_PROVIDER_AUTH_ERROR
    assert "internal secret" not in data["error"]


def test_test_commands_expose_only_approved_cmd_patterns(client):
    response = client.get("/api/test-commands")

    assert response.status_code == 200
    commands = {item["id"]: item["command"] for item in response.json()["commands"]}
    assert commands["frontend-lint"] == ["cmd.exe", "/C", "npm run lint"]
    assert commands["backend-pytest"] == ["cmd.exe", "/C", ".venv\\Scripts\\python.exe -m pytest"]


def test_test_run_executes_approved_command_and_records_history(client, monkeypatch):
    calls = []

    def fake_run(command, cwd, capture_output, text, timeout):
        calls.append(
            {
                "command": command,
                "cwd": cwd,
                "capture_output": capture_output,
                "text": text,
                "timeout": timeout,
            }
        )
        return subprocess.CompletedProcess(command, 0, stdout="lint ok", stderr="")

    monkeypatch.setattr(server.subprocess, "run", fake_run)

    response = client.post(
        "/api/test-runs",
        json={"command_id": "frontend-lint", "timeout_seconds": 5},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["command_id"] == "frontend-lint"
    assert data["command"] == ["cmd.exe", "/C", "npm run lint"]
    assert data["status"] == "passed"
    assert data["exit_code"] == 0
    assert data["stdout"] == "lint ok"
    assert calls == [
        {
            "command": ["cmd.exe", "/C", "npm run lint"],
            "cwd": server.PROJECT_ROOT,
            "capture_output": True,
            "text": True,
            "timeout": 5,
        }
    ]

    history = client.get("/api/test-runs")
    assert history.status_code == 200
    assert history.json()["runs"][0]["id"] == data["id"]


def test_test_run_history_is_persisted_for_restart(client, monkeypatch):
    def fake_run(command, **kwargs):
        return subprocess.CompletedProcess(command, 0, stdout="build ok", stderr="")

    monkeypatch.setattr(server.subprocess, "run", fake_run)

    response = client.post("/api/test-runs", json={"command_id": "frontend-build"})

    assert response.status_code == 200
    run = response.json()
    assert server.TEST_RUN_HISTORY_PATH.exists()

    reloaded_history = server._load_test_run_history()
    assert reloaded_history[-1]["id"] == run["id"]
    assert reloaded_history[-1]["stdout"] == "build ok"


def test_test_run_accepts_exact_readme_style_command_string(client, monkeypatch):
    def fake_run(command, **kwargs):
        return subprocess.CompletedProcess(command, 1, stdout="", stderr="tests failed")

    monkeypatch.setattr(server.subprocess, "run", fake_run)

    response = client.post(
        "/api/test-runs",
        json={"command": 'cmd.exe /C ".venv\\Scripts\\python.exe -m pytest"'},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["command_id"] == "backend-pytest"
    assert data["status"] == "failed"
    assert data["exit_code"] == 1
    assert data["stderr"] == "tests failed"


def test_test_run_rejects_dangerous_or_unknown_commands(client):
    response = client.post("/api/test-runs", json={"command": "rm -rf ."})

    assert response.status_code == 400
    assert response.json()["detail"] == "Command is not approved for execution."


def test_test_run_timeout_records_captured_output(client, monkeypatch):
    def fake_run(command, **kwargs):
        raise subprocess.TimeoutExpired(
            command,
            timeout=kwargs["timeout"],
            output="partial stdout",
            stderr="partial stderr",
        )

    monkeypatch.setattr(server.subprocess, "run", fake_run)

    response = client.post(
        "/api/test-runs",
        json={"command_id": "frontend-build", "timeout_seconds": 1},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "timeout"
    assert data["exit_code"] is None
    assert data["stdout"] == "partial stdout"
    assert data["stderr"] == "partial stderr"
    assert data["timed_out"] is True


def test_test_run_rejects_unreasonable_timeout(client):
    response = client.post(
        "/api/test-runs",
        json={"command_id": "frontend-build", "timeout_seconds": server.MAX_TEST_TIMEOUT_SECONDS + 1},
    )

    assert response.status_code == 400
    assert "timeout_seconds" in response.json()["detail"]


def test_static_serving_can_be_disabled_or_auto_skips_missing_dist(monkeypatch, tmp_path):
    missing_dist = tmp_path / "missing-dist"

    monkeypatch.setenv("QA_ENGINE_SERVE_STATIC", "0")
    assert server._should_mount_static(missing_dist) is False

    monkeypatch.setenv("QA_ENGINE_SERVE_STATIC", "auto")
    assert server._should_mount_static(missing_dist) is False
    assert server._should_mount_static(tmp_path) is True
