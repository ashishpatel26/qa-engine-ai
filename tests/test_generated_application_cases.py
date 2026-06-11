import subprocess

import pytest

import server


def test_generated_agent_test_runner_rejects_mismatched_id(client):
    """Generated testcase: command consistency is validated."""
    response = client.post(
        "/api/test-runs",
        json={
            "command_id": "frontend-lint",
            "command": ["cmd.exe", "/C", "npm run build"],
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "command does not match command_id."


def test_generated_agent_test_runner_requires_command_or_id(client):
    """Generated testcase: test-run agent rejects empty execution requests."""
    response = client.post("/api/test-runs", json={})

    assert response.status_code == 400
    assert response.json()["detail"] == "command_id or command is required."


def test_generated_agent_test_runner_clips_large_output_and_keeps_recent_history(
    client,
    monkeypatch,
):
    """Generated testcase: output and history limits are enforced."""
    monkeypatch.setattr(server, "RUN_OUTPUT_LIMIT", 12)
    monkeypatch.setattr(server, "RUN_HISTORY_LIMIT", 2)

    def fake_run(command, **kwargs):
        return subprocess.CompletedProcess(
            command,
            0,
            stdout="abcdefghijklmnopqrstuvwxyz",
            stderr="",
        )

    monkeypatch.setattr(server.subprocess, "run", fake_run)

    first = client.post(
        "/api/test-runs",
        json={"command_id": "frontend-lint"},
    )
    second = client.post(
        "/api/test-runs",
        json={"command_id": "frontend-build"},
    )
    third = client.post(
        "/api/test-runs",
        json={"command_id": "backend-py-compile"},
    )

    assert first.status_code == second.status_code == third.status_code == 200
    assert third.json()["stdout"] == "abcdefghijkl\n...[output truncated]"

    history = client.get("/api/test-runs")
    assert history.status_code == 200
    runs = history.json()["runs"]
    assert [run["id"] for run in runs] == [third.json()["id"], second.json()["id"]]
    assert first.json()["id"] not in {run["id"] for run in runs}


@pytest.mark.parametrize(
    ("payload", "expected_detail"),
    [
        (
            {"messages": [{"role": "tool", "content": "hello"}]},
            "Unsupported chat role: tool",
        ),
        (
            {"messages": [{"role": "user", "content": "   "}]},
            "Chat messages must not be empty.",
        ),
    ],
)
def test_generated_agent_chat_validation_rejects_invalid_turns(
    client,
    payload,
    expected_detail,
):
    """Generated testcase: chat-validation agent covers malformed chat turns."""
    payload = {**payload, "api_key": "sk-test"}

    response = client.post("/api/chat", json=payload)

    assert response.status_code == 400
    assert response.json()["detail"] == expected_detail


def test_generated_agent_static_mount_for_existing_build(monkeypatch):
    """Generated testcase: explicit static serving can be enabled."""
    monkeypatch.setenv("QA_ENGINE_SERVE_STATIC", "1")

    assert server._should_mount_static(server.PROJECT_ROOT / "dist") is True
