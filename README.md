# QA Engine

QA Engine is a **Demo Prototype** of a browser-based AI QA and coding assistant command center. The current repo is useful for exploring the intended UX and API shape, but many product-critical flows still use mock or in-memory behavior.

## Project Status

- Status: **Demo Prototype**
- Current goal: stabilize the prototype, label mock behavior honestly, and build toward a real MVP vertical slice.
- Implemented MVP slices: real OpenAI-backed chat path, workspace file listing/read, checksum-validated patch apply API, persisted non-secret settings, allowlisted test execution, and persisted run history.
- Next milestone focus: broader patch proposal generation, accessibility, responsive hardening, and dependency-tree cleanup.

## Current Architecture

- Frontend: React 19 + Vite app in `src/`, with panes for workspace, chat, terminal, monitor, test suites, results, debugger, and settings.
- Backend: FastAPI app in `server.py`, with API routes for status, settings, chat, workspace file access, patch proposals/apply, provider connect/disconnect, OAuth callbacks, API key checks, Ollama detection, and test runs.
- Dev proxy: Vite serves the frontend at `http://localhost:5173` and proxies `/api` to `http://localhost:8000`.
- Static serving: the backend mounts `dist/`, so a backend-only static run expects the frontend to be built first.
- State: non-secret provider settings and test run history persist to local JSON under `.qa_engine/`; secrets remain session-only.

## Setup

Run commands from the repo root: `D:\Projects\QAEngine`.

### Windows cmd.exe

```bat
cd /d D:\Projects\QAEngine
npm install
```

Backend dependencies are expected in the checked-out virtual environment:

```bat
cd /d D:\Projects\QAEngine
.venv\Scripts\python.exe -m pip install -e .
```

### WSL Caveat

This checkout is Windows-oriented. If working from WSL, prefer the Windows command bridge for Node and Python commands:

```sh
cmd.exe /C npm run build
cmd.exe /C npm run lint
cmd.exe /C ".venv\\Scripts\\python.exe -m py_compile server.py"
```

Linux-side `npm` may fail in WSL 1 for this project; the project review verified the Windows `cmd.exe` path instead.

## Run Locally

Start the backend for frontend development:

```bat
cd /d D:\Projects\QAEngine
.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8000 --reload
```

In another terminal, start Vite:

```bat
cd /d D:\Projects\QAEngine
npm run dev
```

Open `http://localhost:5173`.

To serve the built app from FastAPI:

```bat
cd /d D:\Projects\QAEngine
npm run build
.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8000
```

## Quality Gate

```bat
cmd.exe /C npm run lint
cmd.exe /C npm run build
cmd.exe /C npm audit --audit-level=moderate
cmd.exe /C ".venv\Scripts\python.exe -m py_compile server.py"
cmd.exe /C ".venv\Scripts\python.exe -m pytest"
```

The current implementation passes lint, build, audit, backend compile, and backend tests.

`npm ls --depth=0` may still report several transitive WASM runtime packages as extraneous even after `npm install` and `npm prune`; this remains tracked in `TASKS.md`.

## Manual Smoke Checklist

1. Start backend and frontend.
2. Open Settings, toggle OpenAI/Anthropic/Workspace Sync, change the Ollama host, refresh, and confirm non-secret settings remain.
3. Send a chat message with `OPENAI_API_KEY` configured or an `api_key` request payload; confirm provider errors are shown when no provider is configured.
4. Open Workspace and select a real project file; confirm real file contents appear.
5. Create a patch proposal through `/api/patch/proposals`, apply it through `/api/patch/apply` with `confirm: true`, and confirm checksum mismatches are rejected.
6. Open Test Suites and run an approved command; confirm Results and Terminal show real stdout/stderr, status, exit code, and duration.

## Known Limitations

- Chat is non-streaming and currently supports the OpenAI provider plus explicit demo mode.
- Monitor cards, debug root-cause text, and some sample chat content remain demo data.
- The legacy `/api/apply-fix` endpoint only works in explicit demo mode; real patching uses `/api/patch/proposals` and `/api/patch/apply`.
- OAuth callbacks are still prototype-only and do not complete a real token exchange.
- Ollama detection only returns sample localhost models in explicit demo mode.
- API keys are not secure secret storage yet and are used only for the active browser/request session.
- Backend state is still single-process and not per-user.
- Static backend serving depends on `dist/` existing.
- Some OAuth callback URLs are hardcoded to `localhost:8080` while the Vite dev proxy targets backend port `8000`.

## Project Docs

- [Project Review](PROJECT_REVIEW.md)
- [Implementation Plan](IMPLEMENTATION_PLAN.md)
- [Task Backlog](TASKS.md)
