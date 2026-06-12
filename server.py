from pathlib import Path
from abc import ABC, abstractmethod
from typing import Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
import time
import os
import subprocess
import urllib.request
import urllib.error
import urllib.parse
import json
import secrets
import hashlib
import base64
import ipaddress
import logging
import uuid
import difflib

logger = logging.getLogger(__name__)

_SERVER_PORT = int(os.getenv("QA_ENGINE_PORT", "8000"))
# OAuth callbacks must land on whatever port the FastAPI process is listening on.
# Dev default: 8000. Prod: set QA_ENGINE_PORT=8080 or QA_ENGINE_OAUTH_CALLBACK_HOST directly.
OAUTH_CALLBACK_HOST = os.getenv(
    "QA_ENGINE_OAUTH_CALLBACK_HOST",
    f"http://localhost:{_SERVER_PORT}",
)

DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:8080",
    "http://localhost:8005",
    "http://localhost:8000",
    "http://localhost:3000",
]

VALID_SERVICES = {"Codex", "ClaudeCode", "OpenAI", "Anthropic", "Ollama"}
VALID_OAUTH_SERVICES = {"codex", "claude"}
OAUTH_SESSION_TTL_SECONDS = int(os.getenv("QA_ENGINE_OAUTH_SESSION_TTL_SECONDS", "600"))
GENERIC_PROVIDER_AUTH_ERROR = "Provider verification failed. Check credentials and network access."
DEMO_OLLAMA_MODELS = ["llama3.1:8b", "codellama:7b", "mistral:7b"]
PROJECT_ROOT = Path(os.getenv("QA_ENGINE_WORKSPACE_ROOT", Path(__file__).resolve().parent)).resolve()
WORKSPACE_MAX_FILE_BYTES = int(os.getenv("QA_ENGINE_MAX_FILE_BYTES", str(256 * 1024)))
WORKSPACE_MAX_LIST_ENTRIES = int(os.getenv("QA_ENGINE_MAX_LIST_ENTRIES", "250"))
WORKSPACE_CONTEXT_FILE_LIMIT = int(os.getenv("QA_ENGINE_CONTEXT_FILE_LIMIT", "5"))
WORKSPACE_EXCLUDED_NAMES = {
    ".git",
    ".venv",
    ".env",
    ".agents",
    ".codegraph",
    ".codex",
    ".cursor",
    ".pytest_cache",
    ".remember",
    ".qa_engine",
    "__pycache__",
    "dist",
    "node_modules",
}
WORKSPACE_ALLOWED_DOTFILES = {".gitignore"}
OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MODELS_URL = "https://api.openai.com/v1/models"
OPENAI_TIMEOUT_SECONDS = float(os.getenv("QA_ENGINE_OPENAI_TIMEOUT_SECONDS", "30"))
DEFAULT_CHAT_MODEL = "gpt-4o-mini"
RUN_HISTORY_LIMIT = int(os.getenv("QA_ENGINE_RUN_HISTORY_LIMIT", "50"))
RUN_OUTPUT_LIMIT = int(os.getenv("QA_ENGINE_RUN_OUTPUT_LIMIT", "20000"))
TEST_RUN_HISTORY_PATH = Path(
    os.getenv("QA_ENGINE_RUN_HISTORY_PATH", str(PROJECT_ROOT / ".qa_engine" / "test_runs.json"))
).resolve()
SETTINGS_PATH = Path(
    os.getenv("QA_ENGINE_SETTINGS_PATH", str(PROJECT_ROOT / ".qa_engine" / "settings.json"))
).resolve()
DEFAULT_TEST_TIMEOUT_SECONDS = int(os.getenv("QA_ENGINE_TEST_TIMEOUT_SECONDS", "120"))
MAX_TEST_TIMEOUT_SECONDS = int(os.getenv("QA_ENGINE_MAX_TEST_TIMEOUT_SECONDS", "300"))
APPROVED_TEST_COMMANDS = {
    "frontend-lint": {
        "label": "Frontend lint",
        "command": ["cmd.exe", "/C", "npm run lint"],
    },
    "frontend-build": {
        "label": "Frontend build",
        "command": ["cmd.exe", "/C", "npm run build"],
    },
    "frontend-audit": {
        "label": "NPM audit",
        "command": ["cmd.exe", "/C", "npm audit --audit-level=moderate"],
    },
    "backend-py-compile": {
        "label": "Backend py_compile",
        "command": ["cmd.exe", "/C", ".venv\\Scripts\\python.exe -m py_compile server.py"],
    },
    "backend-pytest": {
        "label": "Backend pytest",
        "command": ["cmd.exe", "/C", ".venv\\Scripts\\python.exe -m pytest"],
    },
}


def _truthy_env(name: str, default: str = "0") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}


def _cors_origins() -> list[str]:
    raw = os.getenv("QA_ENGINE_CORS_ORIGINS")
    if not raw:
        return DEFAULT_CORS_ORIGINS
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def _initial_app_state() -> dict:
    return {
        "fix_applied": False,
        "services_connected": {
            "Codex": False,
            "ClaudeCode": False,
            "OpenAI": False,
            "Anthropic": False,
            "Ollama": False,
        },
        "ollama_host": "http://localhost:11434",
        "ollama_connected": False,
        "ollama_models": [],
        "codex_user": None,
        "claude_user": None,
        "workspace_root": None,
    }


def _effective_workspace_root() -> Path:
    custom = app_state.get("workspace_root")
    if custom:
        return Path(custom).resolve()
    return PROJECT_ROOT


def _default_settings() -> dict[str, Any]:
    return {
        "sync_enabled": False,
        "openai_enabled": True,
        "anthropic_enabled": False,
        "ollama_host": "http://localhost:11434",
    }


def _load_settings(path: Path | None = None) -> dict[str, Any]:
    settings_path = path or SETTINGS_PATH
    defaults = _default_settings()
    if not settings_path.exists():
        return defaults

    try:
        data = json.loads(settings_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Unable to load settings from %s: %s", settings_path, exc)
        return defaults

    if not isinstance(data, dict):
        logger.warning("Ignoring settings with unexpected shape at %s", settings_path)
        return defaults

    return {
        **defaults,
        "sync_enabled": bool(data.get("sync_enabled", defaults["sync_enabled"])),
        "openai_enabled": bool(data.get("openai_enabled", defaults["openai_enabled"])),
        "anthropic_enabled": bool(data.get("anthropic_enabled", defaults["anthropic_enabled"])),
        "ollama_host": str(data.get("ollama_host") or defaults["ollama_host"]),
    }


def _persist_settings(settings: dict[str, Any], path: Path | None = None) -> None:
    settings_path = path or SETTINGS_PATH
    try:
        settings_path.parent.mkdir(parents=True, exist_ok=True)
        settings_path.write_text(json.dumps(settings, indent=2), encoding="utf-8")
    except OSError as exc:
        logger.warning("Unable to persist settings to %s: %s", settings_path, exc)


def _load_test_run_history(path: Path | None = None) -> list[dict[str, Any]]:
    history_path = path or TEST_RUN_HISTORY_PATH
    if not history_path.exists():
        return []

    try:
        data = json.loads(history_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Unable to load test run history from %s: %s", history_path, exc)
        return []

    if not isinstance(data, list):
        logger.warning("Ignoring test run history with unexpected shape at %s", history_path)
        return []

    runs = [item for item in data if isinstance(item, dict)]
    return runs[-RUN_HISTORY_LIMIT:]


def _persist_test_run_history(path: Path | None = None) -> None:
    history_path = path or TEST_RUN_HISTORY_PATH
    try:
        history_path.parent.mkdir(parents=True, exist_ok=True)
        history_path.write_text(json.dumps(test_run_history[-RUN_HISTORY_LIMIT:], indent=2), encoding="utf-8")
    except OSError as exc:
        logger.warning("Unable to persist test run history to %s: %s", history_path, exc)


app = FastAPI(title="QA Engine Backend")

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory application state (renamed app_state to avoid clash with OAuth `state` param)
app_state = _initial_app_state()
app_settings = _load_settings()
app_state["ollama_host"] = app_settings["ollama_host"]

# OAuth session store: state_token -> {service, status, user}
oauth_sessions: dict = {}
test_run_history: list[dict[str, Any]] = _load_test_run_history()


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str | None = None
    messages: list[ChatTurn] = Field(default_factory=list)
    model: str = DEFAULT_CHAT_MODEL
    provider: str | None = None
    api_key: str | None = None
    context_files: list[str] = Field(default_factory=list)


class ChatResponse(BaseModel):
    sender: str = "assistant"
    name: str = "QA Engine"
    content: str
    logs: list[str] = Field(default_factory=list)
    has_patch: bool = False
    file: str = ""
    provider: str
    model: str
    context_files: list[dict[str, Any]] = Field(default_factory=list)
    patch_proposals: list[dict[str, Any]] = Field(default_factory=list)


class TestRunRequest(BaseModel):
    command_id: str | None = None
    command: list[str] | str | None = None
    timeout_seconds: int | None = None


class SettingsRequest(BaseModel):
    sync_enabled: bool | None = None
    openai_enabled: bool | None = None
    anthropic_enabled: bool | None = None
    ollama_host: str | None = None


class PatchProposalRequest(BaseModel):
    target_file: str
    find: str
    replace: str
    explanation: str = ""


class PatchApplyRequest(BaseModel):
    target_file: str
    original_checksum: str
    replacement: str
    confirm: bool = False


class ConnectRequest(BaseModel):
    service: str

class OllamaDetectRequest(BaseModel):
    host: str

class AuthCheckRequest(BaseModel):
    api_key: str


class SetWorkspaceRootRequest(BaseModel):
    path: str


class GenerateTestsRequest(BaseModel):
    target_file: str | None = None
    output_file: str | None = None
    api_key: str | None = None
    provider: str | None = None


# ─── OAuth / PKCE helpers ─────────────────────────────────────────────────────

def _reset_state_for_tests() -> None:
    app_state.clear()
    app_state.update(_initial_app_state())
    app_settings.clear()
    app_settings.update(_default_settings())
    app_state["ollama_host"] = app_settings["ollama_host"]
    oauth_sessions.clear()
    test_run_history.clear()
    try:
        TEST_RUN_HISTORY_PATH.unlink(missing_ok=True)
    except OSError:
        pass
    try:
        SETTINGS_PATH.unlink(missing_ok=True)
    except OSError:
        pass


def _validate_service(service: str) -> str:
    if service not in VALID_SERVICES:
        raise HTTPException(status_code=400, detail=f"Unknown service: {service}")
    return service


def _validate_oauth_service(service: str) -> str:
    if service not in VALID_OAUTH_SERVICES:
        raise HTTPException(status_code=400, detail=f"Unknown service: {service}")
    return service


def _new_oauth_session(service: str, code_verifier: str, frontend_origin: str = "") -> dict:
    now = time.time()
    return {
        "service": service,
        "status": "pending",
        "user": None,
        "code_verifier": code_verifier,
        "frontend_origin": frontend_origin,
        "created_at": now,
        "expires_at": now + OAUTH_SESSION_TTL_SECONDS,
    }


def _cleanup_oauth_sessions(now: float | None = None) -> None:
    current_time = now if now is not None else time.time()
    expired_tokens = [
        token
        for token, session in oauth_sessions.items()
        if session.get("expires_at", 0) <= current_time
    ]
    for token in expired_tokens:
        oauth_sessions.pop(token, None)


def _public_oauth_session(service: str, session: dict | None) -> dict:
    if not session or session.get("service") != service:
        return {"status": "unknown", "service": service, "user": None}
    return {
        "status": session.get("status", "unknown"),
        "service": session.get("service"),
        "user": session.get("user"),
    }

def _pkce_pair() -> tuple[str, str]:
    """Generate a (code_verifier, code_challenge) pair using S256 method."""
    code_verifier = secrets.token_urlsafe(96)          # 128-char URL-safe string
    digest = hashlib.sha256(code_verifier.encode()).digest()
    code_challenge = base64.urlsafe_b64encode(digest).rstrip(b'=').decode()
    return code_verifier, code_challenge


# ─── OAuth endpoints ─────────────────────────────────────────────────────────

@app.get("/api/oauth/{service}/start")
def oauth_start(service: str, request: Request):
    """
    Generate an OAuth PKCE state token and return the provider authorization URL.
    service: "codex" | "claude"
    """
    _validate_oauth_service(service)
    _cleanup_oauth_sessions()

    # Capture the caller's origin so the callback can use it as postMessage targetOrigin.
    frontend_origin = request.headers.get("origin", "").strip() or OAUTH_CALLBACK_HOST

    state_token    = secrets.token_urlsafe(20)
    code_verifier, code_challenge = _pkce_pair()

    oauth_sessions[state_token] = _new_oauth_session(service, code_verifier, frontend_origin)

    if service == "codex":
        # OpenAI uses auth.openai.com with PKCE.
        # The redirect_uri must match what the registered app expects.
        # We use our local callback endpoint here.
        callback_url = f"{OAUTH_CALLBACK_HOST}/api/oauth/codex/callback"
        params = urllib.parse.urlencode({
            "client_id":             "Gqbzun7No4veAl6GqWVdZnqrMPRVeFAH",
            "redirect_uri":          callback_url,
            "response_type":         "code",
            "scope":                 "openid email profile",
            "state":                 state_token,
            "code_challenge":        code_challenge,
            "code_challenge_method": "S256",
            "prompt":                "login",
        })
        auth_url = f"https://auth.openai.com/authorize?{params}"

    elif service == "claude":
        # The Claude Code CLI client_id (9d1c250a-…) is a public PKCE client.
        # Its registered redirect_uri is exactly "http://localhost" (no port);
        # any localhost port redirect is accepted by this client.
        callback_url = f"{OAUTH_CALLBACK_HOST}/api/oauth/claude/callback"
        params = urllib.parse.urlencode({
            "client_id":             "9d1c250a-e61b-44d8-a05c-7f5bd38ec08c",
            "redirect_uri":          callback_url,
            "response_type":         "code",
            "scope":                 "user:inference",
            "state":                 state_token,
            "code_challenge":        code_challenge,
            "code_challenge_method": "S256",
        })
        auth_url = f"https://claude.ai/oauth/authorize?{params}"

    else:
        raise HTTPException(status_code=400, detail=f"Unknown service: {service}")

    return {"auth_url": auth_url, "state": state_token}


@app.get("/api/oauth/{service}/callback")
def oauth_callback(service: str, code: str = None, state: str = None, error: str = None):
    """
    OAuth redirect callback — served as HTML so the popup can postMessage the result
    back to the parent window, then self-close.
    """
    _validate_oauth_service(service)
    _cleanup_oauth_sessions()

    def _origin(s: str) -> str:
        return oauth_sessions.get(s, {}).get("frontend_origin", OAUTH_CALLBACK_HOST)

    if error:
        if state and state in oauth_sessions:
            oauth_sessions[state]["status"] = "error"
        html = _callback_html(service, success=False,
                              message=f"Authorization denied: {error}",
                              state=state or "",
                              frontend_origin=_origin(state or ""))
        return HTMLResponse(html)

    if not code or not state or state not in oauth_sessions:
        html = _callback_html(service, success=False,
                              message="Invalid callback parameters — session not found.",
                              state=state or "",
                              frontend_origin=OAUTH_CALLBACK_HOST)
        return HTMLResponse(html)

    if oauth_sessions[state].get("service") != service:
        oauth_sessions[state]["status"] = "error"
        html = _callback_html(service, success=False,
                              message="OAuth state does not match this service.",
                              state=state,
                              frontend_origin=_origin(state))
        return HTMLResponse(html)

    # Mark session as completed
    oauth_sessions[state]["status"] = "completed"
    service_label = "Codex (OpenAI)" if service == "codex" else "ClaudeCode (Anthropic)"

    if service == "codex":
        app_state["services_connected"]["Codex"] = True
        user_info = {"name": "OpenAI User", "scope": "openid email profile", "models": ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"]}
    else:
        app_state["services_connected"]["ClaudeCode"] = True
        user_info = {"name": "Claude User", "scope": "user:inference", "models": ["claude-opus-4-5", "claude-sonnet-4-5", "claude-3-5-haiku"]}

    oauth_sessions[state]["user"] = user_info

    html = _callback_html(service, success=True,
                          message=f"Successfully connected {service_label}!",
                          state=state,
                          user=user_info,
                          frontend_origin=_origin(state))
    return HTMLResponse(html)


@app.get("/api/oauth/{service}/status")
def oauth_status(service: str, state_token: str):
    """Poll this endpoint to check if OAuth completed for a given state token."""
    _validate_oauth_service(service)
    _cleanup_oauth_sessions()
    session = oauth_sessions.get(state_token)
    return _public_oauth_session(service, session)


def _callback_html(service: str, success: bool, message: str, state: str, user: dict = None, frontend_origin: str = "") -> str:
    """Premium branded callback page — postMessages result to parent then self-closes."""
    is_codex      = service == "codex"
    service_label = "Codex" if is_codex else "ClaudeCode"
    company       = "OpenAI" if is_codex else "Anthropic"
    accent        = "#10a37f" if is_codex else "#cc785c"
    accent_dim    = "#0e916e" if is_codex else "#b56749"
    user_json     = json.dumps(user or {})

    # Inline SVG logos
    openai_svg = """<svg width="36" height="36" viewBox="0 0 41 41" fill="currentColor">
      <path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835 9.964 9.964 0 0 0-6.525-3.499 10.079 10.079 0 0 0-10.42 4.963 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 6.525 3.499 10.079 10.079 0 0 0 10.42-4.963 9.967 9.967 0 0 0 6.664-4.834 10.079 10.079 0 0 0-1.24-11.818zm-17.208 23.596a7.476 7.476 0 0 1-4.801-1.735c.061-.033.168-.091.237-.134l7.964-4.6a1.294 1.294 0 0 0 .655-1.134V19.054l3.366 1.944a.12.12 0 0 1 .066.092v9.299a7.505 7.505 0 0 1-7.487 7.077zM6.392 31.006a7.471 7.471 0 0 1-.894-5.023c.06.036.162.099.237.141l7.964 4.6a1.297 1.297 0 0 0 1.308 0l9.724-5.614v3.888a.12.12 0 0 1-.048.103L16.759 33.6a7.504 7.504 0 0 1-10.367-2.594zM4.297 13.62A7.469 7.469 0 0 1 8.2 10.333c0 .068-.004.19-.004.274v9.201a1.294 1.294 0 0 0 .654 1.132l9.723 5.614-3.366 1.944a.12.12 0 0 1-.114.012L7.044 23.51a7.504 7.504 0 0 1-2.747-9.89zm27.658 6.437l-9.724-5.615 3.367-1.943a.121.121 0 0 1 .114-.012l8.048 4.648a7.498 7.498 0 0 1-1.158 13.528v-9.476a1.293 1.293 0 0 0-.647-1.13zm3.35-5.043c-.059-.037-.162-.099-.236-.141l-7.965-4.6a1.298 1.298 0 0 0-1.308 0l-9.723 5.614v-3.888a.12.12 0 0 1 .048-.103l8.048-4.648a7.498 7.498 0 0 1 11.136 7.766zm-21.063 6.929l-3.367-1.944a.12.12 0 0 1-.065-.092v-9.299a7.497 7.497 0 0 1 12.293-5.756 6.94 6.94 0 0 0-.236.134l-7.965 4.6a1.294 1.294 0 0 0-.654 1.132l-.006 11.225zm1.829-3.943l4.33-2.501 4.332 2.498v4.997l-4.331 2.5-4.331-2.5V18z"/>
    </svg>"""
    anthropic_svg = """<svg width="36" height="36" viewBox="0 0 100 100" fill="currentColor">
      <path d="M66.7 20H80L53.3 80H40L66.7 20Z"/><path d="M33.3 20H20L46.7 80H60L33.3 20Z"/>
    </svg>"""
    logo_svg = openai_svg if is_codex else anthropic_svg

    models_html = ""
    if success and user and user.get("models"):
        badges = "".join(
            f'<span style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);'
            f'border-radius:6px;padding:3px 10px;font-size:11px;font-family:monospace;color:#e2e8f0;">{m}</span>'
            for m in user["models"][:4]
        )
        models_html = f"""
        <div style="margin-top:16px;text-align:center;">
          <p style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:rgba(255,255,255,0.3);margin-bottom:8px;">Available Models</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">{badges}</div>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>QA Engine – {service_label} {'Connected' if success else 'Error'}</title>
  <style>
    *{{box-sizing:border-box;margin:0;padding:0}}
    body{{
      background:#0a0c12;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:24px;
      position:relative;
      overflow:hidden;
    }}
    .glow{{
      position:absolute;
      width:400px;height:200px;
      border-radius:50%;
      background:{accent};
      opacity:0.12;
      filter:blur(80px);
      top:-60px;left:50%;
      transform:translateX(-50%);
      pointer-events:none;
    }}
    .card{{
      position:relative;
      background:linear-gradient(160deg,#15171f,#0f1117);
      border:1px solid {'rgba(16,163,127,0.3)' if (success and is_codex) else 'rgba(204,120,92,0.3)' if success else 'rgba(239,68,68,0.25)'};
      border-radius:20px;
      padding:40px 36px 32px;
      max-width:400px;
      width:100%;
      text-align:center;
      box-shadow:0 24px 64px rgba(0,0,0,0.6);
      animation:slideUp .4s cubic-bezier(.16,1,.3,1) both;
    }}
    @keyframes slideUp{{from{{opacity:0;transform:translateY(20px)}}to{{opacity:1;transform:translateY(0)}}}}
    .logo-ring{{
      width:72px;height:72px;border-radius:18px;
      background:{'linear-gradient(135deg,'+accent+','+accent_dim+')' if success else 'rgba(239,68,68,0.15)'};
      border:{'2px solid transparent' if success else '1px solid rgba(239,68,68,0.3)'};
      display:flex;align-items:center;justify-content:center;
      margin:0 auto 20px;
      color:#fff;
      box-shadow:{'0 8px 32px '+accent+'55' if success else 'none'};
    }}
    .status-dot{{
      display:inline-flex;align-items:center;gap:6px;
      background:{'rgba(34,197,94,0.1)' if success else 'rgba(239,68,68,0.1)'};
      border:1px solid {'rgba(34,197,94,0.3)' if success else 'rgba(239,68,68,0.3)'};
      border-radius:100px;padding:4px 12px;
      font-size:11px;font-weight:600;
      color:{'#4ade80' if success else '#f87171'};
      margin-bottom:16px;
    }}
    .dot{{width:6px;height:6px;border-radius:50%;background:currentColor;}}
    h2{{font-size:20px;font-weight:700;color:#f8fafc;margin-bottom:8px;}}
    .sub{{font-size:13px;color:rgba(255,255,255,0.45);line-height:1.6;}}
    .timer{{
      margin-top:24px;
      height:3px;
      background:rgba(255,255,255,0.06);
      border-radius:100px;
      overflow:hidden;
    }}
    .timer-bar{{
      height:100%;
      background:{accent};
      border-radius:100px;
      animation:drain 2.2s linear forwards;
    }}
    @keyframes drain{{from{{width:100%}}to{{width:0%}}}}
    .hint{{font-size:11px;color:rgba(255,255,255,0.2);margin-top:10px;}}
  </style>
</head>
<body>
  <div class="glow"></div>
  <div class="card">
    <div class="logo-ring">{logo_svg}</div>
    <div class="status-dot">
      <div class="dot"></div>
      {'Connected to ' + company if success else 'Connection Failed'}
    </div>
    <h2>{'Authorization Complete' if success else 'Authorization Failed'}</h2>
    <p class="sub">{message}</p>
    {models_html}
    <div class="timer"><div class="timer-bar"></div></div>
    <p class="hint">Returning to QA Engine…</p>
  </div>
  <script>
    const payload = {{
      type: 'QA_ENGINE_OAUTH',
      success: {'true' if success else 'false'},
      service: '{service}',
      message: {json.dumps(message)},
      user: {user_json},
      state: {json.dumps(state)}
    }};
    // Restrict postMessage to the frontend origin captured at oauth_start time.
    const targetOrigin = {json.dumps(frontend_origin or OAUTH_CALLBACK_HOST)};
    if (window.opener && !window.opener.closed) {{
      window.opener.postMessage(payload, targetOrigin);
    }}
    // Also broadcast to any same-origin tabs
    try {{ localStorage.setItem('qa_oauth_result', JSON.stringify(payload)); }} catch(e) {{}}
    // Close popup after animation
    setTimeout(() => window.close(), 2300);
  </script>
</body>
</html>"""


# ─── Service connect/disconnect ───────────────────────────────────────────────

@app.get("/api/status")
def get_status():
    return app_state


@app.get("/api/settings")
def get_settings():
    return app_settings


@app.post("/api/settings")
def update_settings(req: SettingsRequest):
    updates = req.model_dump(exclude_unset=True)
    if "ollama_host" in updates and updates["ollama_host"] is not None:
        updates["ollama_host"] = updates["ollama_host"].strip() or _default_settings()["ollama_host"]

    for key in ("sync_enabled", "openai_enabled", "anthropic_enabled", "ollama_host"):
        if key in updates and updates[key] is not None:
            app_settings[key] = updates[key]

    app_state["ollama_host"] = app_settings["ollama_host"]
    _persist_settings(app_settings)
    return app_settings


@app.post("/api/apply-fix")
def apply_fix():
    if not _truthy_env("QA_ENGINE_DEMO_MODE"):
        raise HTTPException(
            status_code=400,
            detail="Demo apply-fix is disabled. Use /api/patch/apply with a validated proposal.",
        )
    app_state["fix_applied"] = True
    return {"success": True}

@app.post("/api/connect")
def connect_service(req: ConnectRequest):
    svc = _validate_service(req.service)
    app_state["services_connected"][svc] = True
    return {"success": True}

@app.post("/api/disconnect")
def disconnect_service(req: ConnectRequest):
    svc = _validate_service(req.service)
    app_state["services_connected"][svc] = False
    if svc == "Codex":
        app_state["codex_user"] = None
    elif svc == "ClaudeCode":
        app_state["claude_user"] = None
    return {"success": True}


# ─── API key verification (fallback method) ───────────────────────────────────

@app.post("/api/auth/codex")
def auth_codex(req: AuthCheckRequest):
    api_key = req.api_key.strip()
    if not api_key or not api_key.startswith("sk-"):
        return {"success": False, "error": "Invalid key format. OpenAI keys start with 'sk-'.", "user": None}
    try:
        url = "https://api.openai.com/v1/models"
        request = urllib.request.Request(url, headers={"Authorization": f"Bearer {api_key}"}, method="GET")
        with urllib.request.urlopen(request, timeout=8) as response:
            data = json.loads(response.read().decode("utf-8"))
            model_ids = [m["id"] for m in data.get("data", [])]
            gpt_models = [m for m in model_ids if "gpt" in m or "codex" in m]
            app_state["services_connected"]["Codex"] = True
            app_state["codex_user"] = {"models": gpt_models[:5]}
            return {"success": True, "user": {"models": gpt_models[:5]},
                    "message": f"Authenticated! {len(model_ids)} models available."}
    except urllib.error.HTTPError as e:
        codes = {401: "Invalid API key (401).", 429: "Rate limit exceeded (429)."}
        return {"success": False, "error": codes.get(e.code, f"HTTP {e.code}"), "user": None}
    except Exception:
        logger.exception("OpenAI API key verification failed")
        return {"success": False, "error": GENERIC_PROVIDER_AUTH_ERROR, "user": None}


@app.post("/api/auth/claude")
def auth_claude(req: AuthCheckRequest):
    api_key = req.api_key.strip()
    if not api_key or not api_key.startswith("sk-ant"):
        return {"success": False, "error": "Invalid key format. Anthropic keys start with 'sk-ant-'.", "user": None}
    try:
        url = "https://api.anthropic.com/v1/models"
        request = urllib.request.Request(url, headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01"
        }, method="GET")
        with urllib.request.urlopen(request, timeout=8) as response:
            data = json.loads(response.read().decode("utf-8"))
            models = [m["id"] for m in data.get("data", [])]
            app_state["services_connected"]["ClaudeCode"] = True
            app_state["claude_user"] = {"models": models}
            return {"success": True, "user": {"models": models},
                    "message": f"Authenticated! {len(models)} Claude models available."}
    except urllib.error.HTTPError as e:
        codes = {401: "Invalid API key (401).", 403: "Forbidden (403).", 429: "Rate limit (429)."}
        return {"success": False, "error": codes.get(e.code, f"HTTP {e.code}"), "user": None}
    except Exception:
        logger.exception("Anthropic API key verification failed")
        return {"success": False, "error": GENERIC_PROVIDER_AUTH_ERROR, "user": None}


# ─── Ollama detection ─────────────────────────────────────────────────────────

def _is_allowed_ollama_hostname(hostname: str) -> bool:
    normalized = hostname.strip().strip("[]").lower()
    if normalized == "localhost":
        return True
    try:
        return ipaddress.ip_address(normalized).is_loopback
    except ValueError:
        return False


def _normalize_ollama_host(raw_host: str) -> str:
    raw = raw_host.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Ollama host is required.")

    if "://" not in raw:
        raw = f"http://{raw}"

    parsed = urllib.parse.urlparse(raw)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Ollama host must use http or https.")
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="Ollama host must include a hostname.")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="Ollama host must not include credentials.")
    try:
        parsed.port
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Ollama host port is invalid.") from exc
    if parsed.path not in {"", "/"} or parsed.params or parsed.query or parsed.fragment:
        raise HTTPException(status_code=400, detail="Ollama host must be a base URL.")
    if not _is_allowed_ollama_hostname(parsed.hostname):
        raise HTTPException(status_code=400, detail="Only local Ollama hosts are allowed.")

    return urllib.parse.urlunparse((parsed.scheme, parsed.netloc, "", "", "", "")).rstrip("/")


def _set_ollama_state(host: str, connected: bool, models: list[str] | None = None) -> None:
    app_state["ollama_host"] = host
    app_state["ollama_connected"] = connected
    app_state["ollama_models"] = models or []
    app_state["services_connected"]["Ollama"] = connected

@app.post("/api/ollama/detect")
def detect_ollama_models(req: OllamaDetectRequest):
    host = _normalize_ollama_host(req.host)
    app_state["ollama_host"] = host
    try:
        url = f"{host}/api/tags"
        req_obj = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req_obj, timeout=2.0) as response:
            data = json.loads(response.read().decode('utf-8'))
            models = [m["name"] for m in data.get("models", [])]
            _set_ollama_state(host, True, models)
            return {"success": True, "models": models}
    except Exception:
        if _truthy_env("QA_ENGINE_DEMO_MODE"):
            _set_ollama_state(host, True, DEMO_OLLAMA_MODELS)
            return {"success": True, "models": DEMO_OLLAMA_MODELS, "demo": True}
        _set_ollama_state(host, False, [])
        return {"success": False, "error": f"Could not connect to Ollama at {host}"}


# ─── Workspace files ──────────────────────────────────────────────────────────

def _public_workspace_path(path: Path) -> str:
    root = _effective_workspace_root()
    relative = path.resolve().relative_to(root)
    return relative.as_posix() or "."


def _resolve_workspace_path(requested_path: str | None) -> Path:
    root = _effective_workspace_root()
    raw_path = (requested_path or ".").strip() or "."
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = root / candidate
    resolved = candidate.resolve()
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Path is outside the workspace root.") from exc
    return resolved


def _read_workspace_text_file(requested_path: str) -> tuple[Path, str, int]:
    target = _resolve_workspace_path(requested_path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found.")
    if not target.is_file():
        raise HTTPException(status_code=400, detail="Path must point to a file.")

    size = target.stat().st_size
    if size > WORKSPACE_MAX_FILE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds {WORKSPACE_MAX_FILE_BYTES} byte read limit.",
        )

    data = target.read_bytes()
    try:
        content = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail="Only UTF-8 text files can be read.") from exc
    return target, content, size


def _sha256_text(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _patch_proposal(
    target: Path,
    original: str,
    replacement: str,
    explanation: str,
) -> dict[str, Any]:
    public_path = _public_workspace_path(target)
    original_checksum = _sha256_text(original)
    diff = "".join(
        difflib.unified_diff(
            original.splitlines(keepends=True),
            replacement.splitlines(keepends=True),
            fromfile=public_path,
            tofile=public_path,
        )
    )

    return {
        "id": hashlib.sha256(f"{public_path}:{original_checksum}:{replacement}".encode("utf-8")).hexdigest()[:16],
        "target_file": public_path,
        "original_checksum": original_checksum,
        "replacement": replacement,
        "unified_diff": diff,
        "explanation": explanation,
    }


@app.get("/api/workspace/files")
def list_workspace_files(path: str = "."):
    target = _resolve_workspace_path(path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="Directory not found.")
    if not target.is_dir():
        raise HTTPException(status_code=400, detail="Path must point to a directory.")

    entries = []
    children = sorted(
        target.iterdir(),
        key=lambda item: (not item.is_dir(), item.name.lower()),
    )
    for child in children:
        if child.name in WORKSPACE_EXCLUDED_NAMES:
            continue
        if child.name.startswith(".") and child.name not in WORKSPACE_ALLOWED_DOTFILES:
            continue
        root = _effective_workspace_root()
        try:
            resolved = child.resolve()
            resolved.relative_to(root)
        except ValueError:
            continue

        entry = {
            "name": child.name,
            "path": _public_workspace_path(resolved),
            "type": "directory" if child.is_dir() else "file",
        }
        if child.is_file():
            entry["size"] = child.stat().st_size
        entries.append(entry)
        if len(entries) >= WORKSPACE_MAX_LIST_ENTRIES:
            break

    return {"root": str(_effective_workspace_root()), "path": _public_workspace_path(target), "entries": entries}


@app.get("/api/workspace/file")
def read_workspace_file(path: str):
    target, content, size = _read_workspace_text_file(path)
    return {
        "path": _public_workspace_path(target),
        "size": size,
        "encoding": "utf-8",
        "content": content,
    }


@app.get("/api/workspace/root")
def get_workspace_root():
    return {"root": str(_effective_workspace_root())}


@app.post("/api/workspace/set-root")
def set_workspace_root(req: SetWorkspaceRootRequest):
    raw = req.path.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Path is required.")
    candidate = Path(raw).expanduser()
    if not candidate.is_absolute():
        raise HTTPException(status_code=400, detail="Path must be absolute.")
    resolved = candidate.resolve()
    if not resolved.exists():
        raise HTTPException(status_code=404, detail="Path does not exist.")
    if not resolved.is_dir():
        raise HTTPException(status_code=400, detail="Path must be a directory.")
    # Security: only allow roots within PROJECT_ROOT or explicitly allowlisted paths.
    # Prevents arbitrary filesystem traversal via generate-tests / workspace file APIs.
    _allowed = {PROJECT_ROOT}
    extra = os.getenv("QA_ENGINE_WORKSPACE_ALLOWLIST", "")
    for p in (p.strip() for p in extra.split(os.pathsep) if p.strip()):
        _allowed.add(Path(p).resolve())
    if not any(
        resolved == allowed or str(resolved).startswith(str(allowed) + os.sep)
        for allowed in _allowed
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Path is outside the allowed workspace roots. "
                "Set QA_ENGINE_WORKSPACE_ALLOWLIST to permit additional directories."
            ),
        )
    app_state["workspace_root"] = str(resolved)
    return {"success": True, "root": str(resolved)}


@app.post("/api/patch/proposals")
def create_patch_proposal(req: PatchProposalRequest):
    target, content, _size = _read_workspace_text_file(req.target_file)
    if not req.find:
        raise HTTPException(status_code=400, detail="find text is required.")
    if req.find not in content:
        raise HTTPException(status_code=400, detail="find text was not found in the target file.")

    replacement = content.replace(req.find, req.replace, 1)
    if replacement == content:
        raise HTTPException(status_code=400, detail="Patch proposal would not change the file.")

    return _patch_proposal(target, content, replacement, req.explanation)


@app.post("/api/patch/apply")
def apply_patch(req: PatchApplyRequest):
    if not req.confirm:
        raise HTTPException(status_code=400, detail="Patch apply requires explicit confirmation.")

    target, content, _size = _read_workspace_text_file(req.target_file)
    current_checksum = _sha256_text(content)
    if current_checksum != req.original_checksum:
        raise HTTPException(status_code=409, detail="Target file changed since the patch was proposed.")

    target.write_bytes(req.replacement.encode("utf-8"))
    app_state["fix_applied"] = True
    return {
        "success": True,
        "path": _public_workspace_path(target),
        "checksum": _sha256_text(req.replacement),
    }


# ─── Chat providers ───────────────────────────────────────────────────────────

class ProviderError(Exception):
    def __init__(self, public_message: str, status_code: int = 502):
        super().__init__(public_message)
        self.public_message = public_message
        self.status_code = status_code


class ChatProvider(ABC):
    name: str

    @abstractmethod
    def list_models(self) -> list[str]:
        raise NotImplementedError

    @abstractmethod
    def chat_completion(self, messages: list[dict[str, str]], model: str) -> str:
        raise NotImplementedError


class OpenAIProvider(ChatProvider):
    name = "openai"

    def __init__(self, api_key: str):
        self.api_key = api_key

    def list_models(self) -> list[str]:
        request = urllib.request.Request(
            OPENAI_MODELS_URL,
            headers={"Authorization": f"Bearer {self.api_key}"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=OPENAI_TIMEOUT_SECONDS) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise ProviderError(_sanitize_openai_http_error(exc), _openai_status_code(exc)) from exc
        except urllib.error.URLError as exc:
            raise ProviderError("Could not reach OpenAI. Check network access.") from exc
        except Exception as exc:
            logger.exception("OpenAI model listing failed")
            raise ProviderError("OpenAI model listing failed.") from exc

        return [item["id"] for item in data.get("data", []) if item.get("id")]

    def chat_completion(self, messages: list[dict[str, str]], model: str) -> str:
        payload = {
            "model": _normalize_openai_model(model),
            "messages": messages,
            "temperature": 0.2,
        }
        request = urllib.request.Request(
            OPENAI_CHAT_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=OPENAI_TIMEOUT_SECONDS) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise ProviderError(_sanitize_openai_http_error(exc), _openai_status_code(exc)) from exc
        except urllib.error.URLError as exc:
            raise ProviderError("Could not reach OpenAI. Check network access.") from exc
        except Exception as exc:
            logger.exception("OpenAI chat completion failed")
            raise ProviderError("OpenAI chat request failed.") from exc

        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError("OpenAI returned an unexpected chat response.") from exc
        if not isinstance(content, str) or not content.strip():
            raise ProviderError("OpenAI returned an empty chat response.")
        return content


class DemoProvider(ChatProvider):
    name = "demo"

    def list_models(self) -> list[str]:
        return ["demo-canned"]

    def chat_completion(self, messages: list[dict[str, str]], model: str) -> str:
        q = " ".join(m["content"] for m in messages if m.get("role") == "user").lower()
        if "generate" in q or ("test" in q and "source" in q):
            return (
                "import pytest\n\n"
                "def test_example_passes():\n"
                "    \"\"\"Demo: generated skeleton test.\"\"\"\n"
                "    assert True\n"
            )
        if "run" in q or "test" in q:
            return "Triggered the regression test runner. All 24 core API units passed. Review the timeline in **Runs**."
        if "auth" in q or "bug" in q:
            return "Detected the session invalidation exception in `AuthSessionManager.ts`. Open **Debugger** or apply the patch."
        return f"Ready to assist in demo mode. Configure OpenAI for real model-backed responses. (Model: {model})"


ANTHROPIC_CHAT_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_TIMEOUT_SECONDS = float(os.getenv("QA_ENGINE_ANTHROPIC_TIMEOUT_SECONDS", "60"))
DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"


class AnthropicProvider(ChatProvider):
    name = "anthropic"

    def __init__(self, api_key: str):
        self.api_key = api_key

    def list_models(self) -> list[str]:
        request = urllib.request.Request(
            "https://api.anthropic.com/v1/models",
            headers={"x-api-key": self.api_key, "anthropic-version": "2023-06-01"},
            method="GET",
        )
        try:
            with urllib.request.urlopen(request, timeout=ANTHROPIC_TIMEOUT_SECONDS) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            raise ProviderError(f"Anthropic model listing failed with HTTP {exc.code}.") from exc
        except Exception as exc:
            raise ProviderError("Anthropic model listing failed.") from exc
        return [item["id"] for item in data.get("data", []) if item.get("id")]

    def chat_completion(self, messages: list[dict[str, str]], model: str) -> str:
        system_parts: list[str] = []
        user_messages: list[dict[str, str]] = []
        for m in messages:
            if m.get("role") == "system":
                system_parts.append(m["content"])
            else:
                user_messages.append(m)

        payload: dict[str, Any] = {
            "model": model or DEFAULT_ANTHROPIC_MODEL,
            "max_tokens": 8192,
            "messages": user_messages,
        }
        if system_parts:
            payload["system"] = "\n\n".join(system_parts)

        request = urllib.request.Request(
            ANTHROPIC_CHAT_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=ANTHROPIC_TIMEOUT_SECONDS) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            code = exc.code
            msg = "Anthropic authentication failed. Check the API key." if code == 401 else f"Anthropic API failed with HTTP {code}."
            raise ProviderError(msg, 401 if code == 401 else 502) from exc
        except urllib.error.URLError as exc:
            raise ProviderError("Could not reach Anthropic. Check network access.") from exc
        except Exception as exc:
            logger.exception("Anthropic chat completion failed")
            raise ProviderError("Anthropic chat request failed.") from exc

        try:
            content = data["content"][0]["text"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError("Anthropic returned an unexpected response.") from exc
        if not isinstance(content, str) or not content.strip():
            raise ProviderError("Anthropic returned an empty response.")
        return content


def _openai_status_code(exc: urllib.error.HTTPError) -> int:
    return 401 if exc.code == 401 else 429 if exc.code == 429 else 502


def _sanitize_openai_http_error(exc: urllib.error.HTTPError) -> str:
    if exc.code == 401:
        return "OpenAI authentication failed. Check the API key."
    if exc.code == 429:
        return "OpenAI rate limit exceeded. Try again later."
    return f"OpenAI chat request failed with HTTP {exc.code}."


def _normalize_openai_model(model: str | None) -> str:
    normalized = (model or DEFAULT_CHAT_MODEL).strip()
    display_name_map = {
        "GPT-4o": "gpt-4o",
        "GPT-4o Mini": "gpt-4o-mini",
        "GPT-4 Turbo": "gpt-4-turbo",
    }
    return display_name_map.get(normalized, normalized or DEFAULT_CHAT_MODEL)


def _openai_api_key(req: ChatRequest) -> str | None:
    candidate = (req.api_key or os.getenv("OPENAI_API_KEY", "")).strip()
    if not candidate:
        return None
    if not candidate.startswith("sk-"):
        raise HTTPException(
            status_code=400,
            detail="OpenAI API key is not usable. It should start with 'sk-'.",
        )
    return candidate


def _provider_for_chat(req: ChatRequest) -> ChatProvider:
    requested_provider = (req.provider or "").strip().lower()

    if requested_provider == "demo":
        if _truthy_env("QA_ENGINE_DEMO_MODE"):
            return DemoProvider()
        raise HTTPException(status_code=400, detail="Demo chat requires QA_ENGINE_DEMO_MODE=true.")

    if requested_provider in {"anthropic", "claude"}:
        api_key = (req.api_key or os.getenv("ANTHROPIC_API_KEY", "")).strip()
        if not api_key:
            raise HTTPException(
                status_code=400,
                detail="No Anthropic API key configured. Set ANTHROPIC_API_KEY or include an api_key in the request.",
            )
        return AnthropicProvider(api_key)

    if requested_provider in {"", "openai", "codex"}:
        api_key = _openai_api_key(req)
        if api_key:
            return OpenAIProvider(api_key)
        if _truthy_env("QA_ENGINE_DEMO_MODE") and not requested_provider:
            return DemoProvider()
        raise HTTPException(
            status_code=400,
            detail="No chat provider configured. Set OPENAI_API_KEY or include an api_key in the request.",
        )

    raise HTTPException(status_code=400, detail=f"Unsupported chat provider: {req.provider}")


def _chat_turns(req: ChatRequest) -> list[dict[str, str]]:
    turns = [{"role": item.role, "content": item.content} for item in req.messages]
    if req.message:
        turns.append({"role": "user", "content": req.message})
    if not turns:
        raise HTTPException(status_code=400, detail="Chat request must include message or messages.")

    allowed_roles = {"system", "user", "assistant"}
    for turn in turns:
        if turn["role"] not in allowed_roles:
            raise HTTPException(status_code=400, detail=f"Unsupported chat role: {turn['role']}")
        if not turn["content"].strip():
            raise HTTPException(status_code=400, detail="Chat messages must not be empty.")
    return turns


def _chat_context(req: ChatRequest) -> tuple[list[dict[str, Any]], str | None]:
    if len(req.context_files) > WORKSPACE_CONTEXT_FILE_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"At most {WORKSPACE_CONTEXT_FILE_LIMIT} context files are allowed.",
        )

    metadata = []
    sections = []
    for file_path in req.context_files:
        target, content, size = _read_workspace_text_file(file_path)
        public_path = _public_workspace_path(target)
        metadata.append({"path": public_path, "size": size})
        sections.append(f"--- {public_path} ---\n{content}")

    if not sections:
        return metadata, None

    system_message = (
        "Workspace context files follow. Use them as reference material only.\n\n"
        + "\n\n".join(sections)
    )
    return metadata, system_message


def _demo_logs(req: ChatRequest) -> tuple[list[str], bool, str]:
    q = " ".join([req.message or "", *(m.content for m in req.messages)]).lower()
    if "run" in q or "test" in q:
        return ["[DEMO] Searching test suites...", "[DEMO] Jest: 24/24 passed."], False, ""
    if "auth" in q or "bug" in q:
        return ["[DEMO] Scanning AuthSessionManager.ts...", "[DEMO] Null Pointer at line 142."], True, "agent.ts"
    return ["[DEMO] Ready.", f"[DEMO] Model: {req.model}"], False, ""


@app.post("/api/chat", response_model=ChatResponse)
def post_chat(req: ChatRequest):
    provider = _provider_for_chat(req)
    turns = _chat_turns(req)
    context_files, context_message = _chat_context(req)
    if context_message:
        turns = [{"role": "system", "content": context_message}, *turns]

    try:
        content = provider.chat_completion(turns, req.model)
    except ProviderError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.public_message) from exc

    if provider.name == "demo":
        logs, has_patch, file_path = _demo_logs(req)
    else:
        logs = [
            f"[INFO] Provider: {provider.name}",
            f"[INFO] Model: {_normalize_openai_model(req.model)}",
            f"[INFO] Context files: {len(context_files)}",
        ]
        has_patch = False
        file_path = ""

    return ChatResponse(
        content=content,
        logs=logs,
        has_patch=has_patch,
        file=file_path,
        provider=provider.name,
        model=_normalize_openai_model(req.model) if provider.name == "openai" else req.model,
        context_files=context_files,
        patch_proposals=[],
    )


# ─── Test command runs ────────────────────────────────────────────────────────

def _command_payload(command_id: str, config: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": command_id,
        "label": config["label"],
        "command": config["command"],
    }


@app.get("/api/test-commands")
def list_test_commands():
    return {
        "commands": [
            _command_payload(command_id, APPROVED_TEST_COMMANDS[command_id])
            for command_id in sorted(APPROVED_TEST_COMMANDS)
        ]
    }


def _canonical_cmd(command: list[str] | str) -> list[str]:
    if isinstance(command, str):
        raw = command.strip()
        prefix = "cmd.exe /C "
        if not raw.lower().startswith(prefix.lower()):
            return [raw]
        command_tail = raw[len(prefix):].strip()
        if len(command_tail) >= 2 and command_tail[0] == command_tail[-1] == '"':
            command_tail = command_tail[1:-1]
        return ["cmd.exe", "/C", command_tail]

    parts = [str(part).strip() for part in command if str(part).strip()]
    if len(parts) >= 3 and parts[0].lower() == "cmd.exe" and parts[1].lower() == "/c":
        return ["cmd.exe", "/C", " ".join(parts[2:])]
    return parts


def _approved_command_id(command: list[str]) -> str | None:
    command_tuple = tuple(command)
    for command_id, config in APPROVED_TEST_COMMANDS.items():
        if tuple(config["command"]) == command_tuple:
            return command_id
    return None


def _resolve_test_command(req: TestRunRequest) -> tuple[str, list[str]]:
    if req.command_id:
        if req.command_id not in APPROVED_TEST_COMMANDS:
            raise HTTPException(status_code=400, detail=f"Unknown test command: {req.command_id}")
        command = APPROVED_TEST_COMMANDS[req.command_id]["command"]
        if req.command is not None and _canonical_cmd(req.command) != command:
            raise HTTPException(status_code=400, detail="command does not match command_id.")
        return req.command_id, command

    if req.command is None:
        raise HTTPException(status_code=400, detail="command_id or command is required.")

    command = _canonical_cmd(req.command)
    command_id = _approved_command_id(command)
    if not command_id:
        raise HTTPException(status_code=400, detail="Command is not approved for execution.")
    return command_id, command


def _run_timeout(req: TestRunRequest) -> int:
    timeout = req.timeout_seconds or DEFAULT_TEST_TIMEOUT_SECONDS
    if timeout < 1 or timeout > MAX_TEST_TIMEOUT_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"timeout_seconds must be between 1 and {MAX_TEST_TIMEOUT_SECONDS}.",
        )
    return timeout


def _clip_output(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        text = value.decode("utf-8", errors="replace")
    else:
        text = str(value)
    if len(text) <= RUN_OUTPUT_LIMIT:
        return text
    return text[:RUN_OUTPUT_LIMIT] + "\n...[output truncated]"


def _record_run(run: dict[str, Any]) -> dict[str, Any]:
    test_run_history.append(run)
    del test_run_history[:-RUN_HISTORY_LIMIT]
    _persist_test_run_history()
    return run


@app.get("/api/test-runs")
def list_test_runs():
    return {"runs": list(reversed(test_run_history))}


@app.post("/api/test-runs")
def create_test_run(req: TestRunRequest):
    command_id, command = _resolve_test_command(req)
    timeout = _run_timeout(req)
    started_at = time.time()
    run_id = uuid.uuid4().hex

    try:
        completed = subprocess.run(
            command,
            cwd=_effective_workspace_root(),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        exit_code = completed.returncode
        status = "passed" if exit_code == 0 else "failed"
        stdout = _clip_output(completed.stdout)
        stderr = _clip_output(completed.stderr)
    except subprocess.TimeoutExpired as exc:
        exit_code = None
        status = "timeout"
        stdout = _clip_output(exc.output)
        stderr = _clip_output(exc.stderr)
    except FileNotFoundError as exc:
        exit_code = 127
        status = "failed"
        stdout = ""
        stderr = f"Command runner unavailable: {exc.filename or command[0]}"

    duration_ms = int((time.time() - started_at) * 1000)
    run = {
        "id": run_id,
        "command_id": command_id,
        "command": command,
        "status": status,
        "exit_code": exit_code,
        "stdout": stdout,
        "stderr": stderr,
        "duration_ms": duration_ms,
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(started_at)),
        "timed_out": status == "timeout",
    }
    return _record_run(run)


# ─── AI test generation ───────────────────────────────────────────────────────

SOURCE_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx"}
_TEST_MARKERS = {"test_", "_test.", ".test.", ".spec."}
GENERATION_MAX_FILES = int(os.getenv("QA_ENGINE_GEN_MAX_FILES", "6"))
_GEN_EXCLUDED = WORKSPACE_EXCLUDED_NAMES | {"tests", "__pycache__", ".codegraph", ".qa_engine", ".remember"}
GENERATION_SYSTEM_PROMPT = (
    "You are an expert software engineer specialising in test automation. "
    "Generate a comprehensive pytest test suite for the provided source code.\n\n"
    "Rules:\n"
    "- Write ONLY valid Python 3 code using pytest — no markdown, no explanation, no code fences\n"
    "- Include all necessary imports at the top\n"
    "- Use pytest fixtures for repeated setup\n"
    "- Test happy paths AND error/edge cases\n"
    "- Mock external HTTP calls, filesystem, subprocess, and database access\n"
    "- Descriptive test names: test_<component>_<scenario>\n"
    "- One-line docstring per test explaining the scenario\n"
    "- For JS/TS frontend files generate FastAPI TestClient integration tests\n"
    "- Return ONLY raw Python — no ```python fences, no commentary"
)


def _is_test_file(name: str) -> bool:
    return any(marker in name for marker in _TEST_MARKERS)


def _collect_source_files(
    root: Path,
    target_file: str | None,
    max_files: int = GENERATION_MAX_FILES,
) -> list[tuple[str, str]]:
    if target_file:
        path, content, _ = _read_workspace_text_file(target_file)
        return [(_public_workspace_path(path), content)]

    collected: list[tuple[str, str]] = []
    for path in sorted(root.rglob("*")):
        if len(collected) >= max_files:
            break
        if not path.is_file():
            continue
        if path.suffix not in SOURCE_EXTENSIONS:
            continue
        if any(part in _GEN_EXCLUDED for part in path.parts):
            continue
        if _is_test_file(path.name):
            continue
        try:
            resolved = path.resolve()
            resolved.relative_to(root)
            if path.stat().st_size > WORKSPACE_MAX_FILE_BYTES:
                continue
            content = path.read_bytes().decode("utf-8", errors="replace")
            collected.append((_public_workspace_path(resolved), content))
        except (ValueError, OSError):
            continue
    return collected


def _build_generation_prompt(files: list[tuple[str, str]]) -> str:
    file_list = "\n".join(f"  - {p}" for p, _ in files)
    sections = "\n\n".join(f"=== {p} ===\n{c}" for p, c in files)
    return (
        f"Analyse the following source files and generate pytest tests.\n\n"
        f"Files:\n{file_list}\n\nSource:\n{sections}"
    )


def _strip_code_fences(code: str) -> str:
    """Remove opening/closing markdown code fences from anywhere in the output.

    Models sometimes prepend a commentary line before the opening fence, so we
    scan all lines rather than assuming the fence is always first/last.
    """
    lines = code.strip().splitlines()
    # Find first opening fence (``` or ```python etc.)
    open_idx = next((i for i, ln in enumerate(lines) if ln.strip().startswith("```")), None)
    if open_idx is not None:
        lines = lines[open_idx + 1:]
    # Find last closing fence
    close_idx = next((i for i in range(len(lines) - 1, -1, -1) if lines[i].strip() == "```"), None)
    if close_idx is not None:
        lines = lines[:close_idx]
    return "\n".join(lines).strip()


@app.post("/api/generate-tests")
def generate_tests(req: GenerateTestsRequest):
    root = _effective_workspace_root()
    files = _collect_source_files(root, req.target_file)
    if not files:
        raise HTTPException(status_code=422, detail="No source files found to generate tests for.")

    chat_req = ChatRequest(api_key=req.api_key, provider=req.provider)
    provider = _provider_for_chat(chat_req)

    turns: list[dict[str, str]] = [
        {"role": "system", "content": GENERATION_SYSTEM_PROMPT},
        {"role": "user", "content": _build_generation_prompt(files)},
    ]
    try:
        raw = provider.chat_completion(turns, None)
    except ProviderError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.public_message) from exc

    generated_code = _strip_code_fences(raw)

    output_path: str | None = None
    if req.output_file:
        try:
            target = _resolve_workspace_path(req.output_file)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(generated_code, encoding="utf-8")
            output_path = _public_workspace_path(target)
        except HTTPException:
            raise
        except OSError as exc:
            raise HTTPException(status_code=500, detail=f"Could not write output file: {exc}") from exc

    return {
        "success": True,
        "generated_code": generated_code,
        "source_files": [p for p, _ in files],
        "output_file": output_path,
        "provider": provider.name,
    }


def _should_mount_static(directory: Path) -> bool:
    mode = os.getenv("QA_ENGINE_SERVE_STATIC", "auto").strip().lower()
    if mode in {"0", "false", "no", "off"}:
        return False
    if mode in {"1", "true", "yes", "on"}:
        return True
    return directory.exists()


def _mount_static_if_configured() -> None:
    static_dir = Path(os.getenv("QA_ENGINE_STATIC_DIR", "dist"))
    if not _should_mount_static(static_dir):
        return

    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


_mount_static_if_configured()
