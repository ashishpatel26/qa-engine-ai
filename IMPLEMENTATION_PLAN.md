# QA Engine Implementation Plan

Date: 2026-06-11
Source review: `PROJECT_REVIEW.md`

## Objective

Move QA Engine from a polished demo prototype into a truthful, testable MVP. The first implementation target is one real vertical slice: authenticated provider configuration, a model-backed chat request, file context from the current workspace, patch preview/apply, test execution, and persisted run results.

## Guiding Decisions

| Decision | Direction | Reason |
|---|---|---|
| Product posture | Label current app as Demo Prototype until real flows exist | The review found many hardcoded and mock-success paths. |
| First delivery shape | Browser UI plus FastAPI backend MVP | This matches the current codebase and avoids a premature CLI/desktop rewrite. |
| Provider scope | Start with OpenAI API key and Ollama local detection | These are already represented in UI/backend and cover cloud/local paths. |
| Safety posture | Fail closed by default | Apply/connect/auth/test actions must not report success when real work fails. |
| Data posture | Persist only non-secret app data first; use environment variables or secure backend storage for secrets | The current settings UI claims secure storage without implementing it. |
| Testing posture | Build tests around current risk areas before expanding features | The product is a QA tool and needs its own quality gates. |

## Phase Plan

| Phase | Name | Goal | Primary Deliverables | Exit Criteria |
|---:|---|---|---|---|
| 0 | Stabilize Prototype Truthfulness | Make the current app honest and clean enough to iterate on. | README rewrite, demo-mode labeling, lint/JSX cleanup, dependency pruning, favicon fix. | `npm run lint`, `npm run build`, and `npm audit --audit-level=moderate` pass; mock/sample surfaces are labeled. |
| 1 | Backend Contract and Tests | Define reliable API contracts and add smoke coverage. | Pydantic response models, service enum validation, sanitized errors, backend test dependencies and tests. | Backend tests cover status, connect/disconnect validation, chat mock, OAuth status sanitization, and Ollama failure/success behavior. |
| 2 | Provider and Settings MVP | Replace false provider success with real verification states. | OpenAI key verification flow, Ollama real detection, no secret-looking default values, saved non-secret settings. | Failed provider checks show errors; successful checks return real model metadata; no fake connected state outside demo mode. |
| 3 | Real Chat Vertical Slice | Implement one model-backed chat path with explicit context. | Provider abstraction, chat request/response schema, optional file context, loading/error UI, no keyword-only canned responses in production mode. | User can send one prompt through a configured provider and receive a real response with clear errors when no provider is configured. |
| 4 | Workspace and Patch Workflow | Connect workspace UI to actual files and make patching explicit. | File tree API, file read endpoint, patch preview format, apply endpoint with validation, React state-based patch buttons. | User can inspect a real file, receive a proposed patch, review it, apply it, and see changed state reflected in UI. |
| 5 | Test Execution and Run Results | Replace hardcoded QA dashboards with real command/run records. | Safe command runner for configured test commands, persisted run model, results API, run details UI. | User can run a configured test command and see real pass/fail output stored as a run result. |
| 6 | UX, Accessibility, and Responsive Pass | Make the MVP usable beyond desktop demos. | Semantic controls, keyboard flows, responsive side panes/tables, design token cleanup, local icon/font strategy. | Desktop and tablet layouts are usable; keyboard-only navigation works for primary flows; no major React console warnings. |

## Workstreams

| Workstream | Scope | Key Files |
|---|---|---|
| Documentation | README, prototype notes, setup, verification commands, limitations | `README.md`, `PROJECT_REVIEW.md`, `IMPLEMENTATION_PLAN.md`, `TASKS.md` |
| Frontend quality | Lint cleanup, JSX attribute fixes, React state cleanup, dependency hygiene | `src/App.jsx`, `src/components/*.jsx`, `index.html`, `package.json` |
| Backend API | Validation, service contracts, auth status sanitization, CORS config, static serving option | `server.py`, `pyproject.toml` |
| Provider integration | OpenAI API key verification, Ollama detection, provider abstraction | `server.py`, `src/components/SettingsPane.jsx` |
| Workspace/patching | Real file browser/read APIs, patch preview/apply, UI state | `server.py`, `src/components/WorkspacePane.jsx`, `src/components/ChatPane.jsx`, `src/components/DebugPane.jsx` |
| Testing and runs | Backend tests, frontend tests, command execution, run storage | `pyproject.toml`, `package.json`, future `tests/` |
| Design/accessibility | Responsive behavior, semantic controls, token consolidation, icon/font fallback | `src/index.css`, `tailwind.config.js`, `src/components/*.jsx` |

## Target Architecture

| Layer | Responsibility | Initial MVP Choice |
|---|---|---|
| Frontend | App shell, chat, workspace, settings, test runs, patch review | Existing React/Vite app |
| Backend API | Provider checks, chat orchestration, workspace file reads, safe command execution, run persistence | Existing FastAPI app with clearer contracts |
| Provider layer | Normalize model calls across configured providers | Start with OpenAI and Ollama-compatible API shape |
| Workspace layer | Read files, list directory, prepare and apply patches | Local project root with path allowlisting |
| Run layer | Execute approved test commands and store output | Local safe command runner plus persisted JSON/SQLite later |
| Persistence | Sessions, settings metadata, run history | Start with local JSON or SQLite; never store raw secrets in plain text |

## Acceptance Gates

| Gate | Command / Check | Required Result |
|---|---|---|
| Frontend lint | `cmd.exe /C npm run lint` | Passes with 0 errors |
| Frontend build | `cmd.exe /C npm run build` | Passes |
| NPM audit | `cmd.exe /C npm audit --audit-level=moderate` | 0 vulnerabilities |
| Backend compile | `cmd.exe /C "D:\Projects\QAEngine\.venv\Scripts\python.exe" -m py_compile server.py` | Passes |
| Backend tests | `cmd.exe /C "D:\Projects\QAEngine\.venv\Scripts\python.exe" -m pytest` | Passes after pytest/httpx2 dependencies are added |
| Manual smoke | Start backend and frontend, then test settings, chat, file read, patch preview, and test run | No false-success states |
| Design smoke | Desktop and tablet viewport pass | No major clipping or unusable fixed panels in primary workflows |
| Accessibility smoke | Keyboard-only pass through navigation, chat send, settings, patch apply | Primary actions reachable and named |

## Risk Plan

| Risk | Mitigation |
|---|---|
| Mock behavior leaks into production UX | Add explicit demo mode and fail closed when disabled. |
| OAuth/security work expands too much | Defer full OAuth until API-key MVP is stable; keep OAuth disabled or clearly demo-only. |
| File and command execution can be unsafe | Add path allowlisting, command allowlisting, previews, and explicit confirmations. |
| UI is too dense on small screens | Collapse secondary panes first instead of trying to make every panel visible. |
| Provider API changes or missing credentials block development | Keep Ollama/local and mocked test fixtures for tests, but never show mock success in production mode. |

## Recommended Execution Order

1. Complete Phase 0 and Phase 1 before adding new product features.
2. Build provider settings before chat, because chat needs a real configured model.
3. Build file read before patch apply, because patches need trustworthy source context.
4. Build test execution before dashboards, because dashboards need real run data.
5. Do accessibility and responsive cleanup continuously, with a focused Phase 6 hardening pass.

