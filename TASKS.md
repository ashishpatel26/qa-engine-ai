# QA Engine Task Backlog

Date: 2026-06-11
Source review: `PROJECT_REVIEW.md`
Plan: `IMPLEMENTATION_PLAN.md`

Status legend: `[ ]` todo, `[~]` in progress, `[x]` done.

## Milestone 0: Prototype Truthfulness and Quality Gate

| ID | Task | Priority | Area | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|---|
| M0-01 | [x] Rewrite `README.md` for QA Engine setup, demo status, backend startup, frontend startup, Windows/WSL note, and known limitations. | P0 | Docs | None | README no longer contains default Vite template text and explains prototype behavior clearly. |
| M0-02 | [x] Add visible demo/sample-data labeling where chat, terminal, test suites, monitor cards, workspace code, and debug diffs are still hardcoded. | P0 | Frontend | M0-01 | Users can tell mock data from real actions. |
| M0-03 | [x] Fix all ESLint errors from unused React imports, unused props, and empty catch blocks. | P0 | Frontend | None | `cmd.exe /C npm run lint` passes. |
| M0-04 | [x] Replace invalid JSX attributes: `class` to `className`, `autocomplete` to `autoComplete`. | P0 | Frontend | None | No React warnings for invalid DOM props in primary views. |
| M0-05 | [x] Replace `ChatPane` direct DOM mutation with React state for patch apply loading/success/error. | P1 | Frontend | M0-03 | No use of `innerHTML` or imperative `className` mutation for patch button state. |
| M0-06 | [x] Fix favicon path from `/vite.svg` to `/favicon.svg` and remove unused starter assets if not needed. | P2 | Frontend | None | Browser tab shows QA Engine favicon. |
| M0-07 | [x] Clean dependency tree by pruning extraneous packages and verifying lockfile consistency. | P2 | Tooling | None | `cmd.exe /C npm ls --depth=0` reports no extraneous packages. |

## Milestone 1: Backend Contracts, Validation, and Tests

| ID | Task | Priority | Area | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|---|
| M1-01 | [x] Add backend dev/test dependencies including `pytest` and the Starlette-required `httpx2`. | P0 | Backend QA | None | FastAPI TestClient can import and run. |
| M1-02 | [x] Add backend test suite for `/api/status`, `/api/connect`, `/api/disconnect`, `/api/chat`, `/api/ollama/detect`, and OAuth status. | P0 | Backend QA | M1-01 | `pytest` passes and covers current API behavior. |
| M1-03 | [x] Validate service names with an enum for connect/disconnect. | P0 | Backend | M1-02 | Unknown service returns HTTP 400 and does not mutate state. |
| M1-04 | [x] Sanitize OAuth status response so `code_verifier` and private session data are never returned. | P0 | Backend Security | M1-02 | Status endpoint returns only public status, service, and user fields. |
| M1-05 | [x] Verify OAuth state is bound to the callback service. | P0 | Backend Security | M1-04 | A Codex state cannot be completed through the Claude callback path. |
| M1-06 | [x] Add TTL cleanup for OAuth sessions. | P1 | Backend Security | M1-04 | Expired sessions cannot be polled or completed. |
| M1-07 | [x] Move CORS origins and static serving behavior to configuration. | P1 | Backend | M1-02 | Local dev still works, and API-only mode can import without requiring `dist`. |
| M1-08 | [x] Sanitize generic provider auth errors returned by `/api/auth/codex` and `/api/auth/claude`. | P1 | Backend Security | M1-02 | Client receives safe error messages; detailed exceptions are server-side only. |

## Milestone 2: Provider Settings MVP

| ID | Task | Priority | Area | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|---|
| M2-01 | [x] Remove prefilled secret-looking API key values from settings state. | P0 | Frontend Security | M0-03 | API key fields are empty by default or use non-secret placeholder text only. |
| M2-02 | [x] Replace "stored securely in system keychain" copy until secure storage exists. | P0 | Frontend UX | M2-01 | Settings text accurately describes current storage behavior. |
| M2-03 | [x] Implement explicit provider verification states: idle, checking, connected, failed, disconnected. | P0 | Frontend | M1-03 | Failed backend calls do not show connected badges. |
| M2-04 | [x] Remove time-based OAuth mock success outside demo mode. | P0 | Frontend Security | M1-04, M1-05 | Closing a popup never creates a real connected account unless backend verifies it. |
| M2-05 | [x] Make Ollama detection return real failure by default and fake models only in explicit demo mode. | P0 | Backend | M1-02 | Localhost without Ollama reports failure unless demo mode is on. |
| M2-06 | [x] Add host parsing and allowlisting for Ollama detection to reduce SSRF risk. | P0 | Backend Security | M2-05 | Only local/allowed hosts can be probed. |
| M2-07 | [x] Persist non-secret provider settings such as enabled providers and base URLs. | P1 | Backend/Frontend | M2-03 | Refresh preserves non-secret settings via `/api/settings` and local JSON storage; API keys remain session-only. |

## Milestone 3: Real Chat Vertical Slice

| ID | Task | Priority | Area | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|---|
| M3-01 | [x] Define provider abstraction interface for model listing and chat completion. | P0 | Backend | M2-03 | Backend can route chat through a configured provider implementation. |
| M3-02 | [x] Implement OpenAI chat path using configured API key or environment variable. | P0 | Backend | M3-01 | A real prompt returns a real provider response when credentials are valid. |
| M3-03 | [x] Implement clear no-provider and provider-error responses. | P0 | Backend/Frontend | M3-02 | UI shows actionable errors instead of canned fallback success. |
| M3-04 | [x] Update `/api/chat` request and response schema for model, messages, context files, logs, and patch proposals. | P1 | Backend | M3-01 | Schema is covered by backend tests and React response mapping. |
| M3-05 | [x] Replace keyword-only canned chat with real provider behavior outside demo mode. | P0 | Backend | M3-02, M3-04 | "run tests" and "auth bug" no longer produce fake success in production mode. |
| M3-06 | [x] Add chat UI loading, retry, and error states. | P1 | Frontend | M3-03 | User sees progress and recoverable errors. |

## Milestone 4: Workspace and Patch Workflow

| ID | Task | Priority | Area | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|---|
| M4-01 | [x] Add backend workspace file listing endpoint with project-root path allowlisting. | P0 | Backend Security | M1-02 | API cannot read outside the allowed workspace root. |
| M4-02 | [x] Add backend file read endpoint for text files with size limits. | P0 | Backend Security | M4-01 | UI can load real project files safely. |
| M4-03 | [x] Replace hardcoded workspace file tree with real API data. | P1 | Frontend | M4-01, M4-02 | Explorer displays actual project files. |
| M4-04 | [x] Replace hardcoded code panels with actual file content view. | P1 | Frontend | M4-02 | Opening a file displays its real contents. |
| M4-05 | [x] Define patch proposal format with target file, original checksum, unified diff, and explanation. | P0 | Backend | M3-04 | Patch proposals are machine-validated before display. |
| M4-06 | [x] Implement patch preview UI from proposal data. | P1 | Frontend | M4-05 | Chat can render real `patch_proposals` unified diff content before applying. |
| M4-07 | [x] Implement apply patch endpoint with checksum/path validation and explicit confirmation. | P0 | Backend Security | M4-05 | Patch apply fails safely if file changed, path is invalid, or confirmation is missing. |
| M4-08 | [x] Wire chat/debug apply buttons to real patch apply state. | P1 | Frontend | M4-07 | Chat applies real proposals through `/api/patch/apply`; DebugPane can create, preview, and apply real proposals. |

## Milestone 5: Test Execution and Run Results

| ID | Task | Priority | Area | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|---|
| M5-01 | [x] Define allowlisted test command configuration. | P0 | Backend Security | M1-02 | Only approved commands can run. |
| M5-02 | [x] Implement safe command runner with timeout, captured output, exit code, and cancellation plan. | P0 | Backend | M5-01 | Backend can run a configured test command and return structured output. |
| M5-03 | [x] Add persisted run result model. | P1 | Backend | M5-02 | Run history survives refresh/restart through local JSON storage. |
| M5-04 | [x] Replace test suite dashboard hardcoded values with run API data. | P1 | Frontend | M5-03 | Suite/result pages show real latest run state. |
| M5-05 | [x] Add frontend controls for starting a configured test run. | P1 | Frontend | M5-02 | Running a suite creates a real run result. |
| M5-06 | [x] Add tests for command validation, timeout behavior, and failed command output. | P0 | Backend QA | M5-02 | Dangerous/unknown commands are rejected in tests. |

## Milestone 6: UX, Accessibility, and Responsive Hardening

| ID | Task | Priority | Area | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|---|
| M6-01 | [x] Replace clickable `div`, `span`, and href-less `a` actions with semantic buttons/links. | P1 | Accessibility | M0-03 | Primary shell and terminal actions use semantic controls. |
| M6-02 | [x] Add accessible names for icon-only controls. | P1 | Accessibility | M6-01 | Screen reader labels are present for primary icon buttons. |
| M6-03 | [x] Add responsive behavior for workspace right rail, results grid, and suite tables. | P1 | Design | M4-03 | Tablet/mobile layouts avoid primary clipping in workspace, results, and suites. |
| M6-04 | [x] Consolidate repeated hardcoded dark colors into design tokens. | P2 | Design | M0-03 | Settings and app shell use more shared theme tokens; remaining exceptions are documented design debt. |
| M6-05 | [x] Align Settings card radii and visual treatment with the IDE-style app shell. | P2 | Design | M6-04 | Settings uses tighter radii and token-based surfaces. |
| M6-06 | [x] Add local fallback or bundling plan for fonts and Material Symbols. | P2 | Design/Build | M0-06 | CSS fallback stack and README bundling plan are documented. |

## Cross-Cutting Verification Tasks

| ID | Task | Priority | Area | Dependencies | Acceptance Criteria |
|---|---|---:|---|---|---|
| V-01 | [x] Add CI-style script or documented command sequence for lint, build, audit, backend compile, and backend tests. | P0 | Tooling | M1-01 | A contributor can run one documented quality gate locally. |
| V-02 | [x] Add manual smoke checklist for provider settings, chat, workspace file open, patch apply, and test run. | P1 | QA | M3-06, M4-08, M5-05 | Checklist exists and maps to MVP flows. |
| V-03 | [x] Re-run `PROJECT_REVIEW.md` checks after Milestone 0 and update statuses. | P1 | Docs/QA | M0-07 | Review file reflects current state after stabilization; M0-07 remains unresolved. |
| V-04 | [x] Add issue labels or columns for `frontend`, `backend`, `security`, `design`, `qa`, and `docs` if using a tracker. | P2 | Process | None | Labels and suggested columns are documented below. |

## Issue Triage Labels

| Label | Use For |
|---|---|
| `frontend` | React app shell, panes, state, browser interactions, and Vite build behavior. |
| `backend` | FastAPI routes, provider integrations, workspace APIs, patch APIs, and command runner behavior. |
| `security` | OAuth, secrets, path allowlisting, command allowlisting, SSRF, and patch confirmation risks. |
| `design` | Visual consistency, responsiveness, tokens, typography, icons, and layout polish. |
| `qa` | Tests, quality gates, smoke checklists, run history, and verification coverage. |
| `docs` | README, review files, implementation plan, task backlog, and onboarding notes. |

Suggested columns: `Backlog`, `Ready`, `In Progress`, `Review`, `Verified`, `Blocked`.

## Immediate Next Sprint

1. Add frontend browser tests for provider settings, workspace file open, patch proposal/apply, and test-run flows.
2. Add streaming chat responses and provider-generated patch proposals.
3. Add cancellation for long-running approved test commands.
4. Expand responsive/accessibility testing beyond primary desktop and tablet flows.
5. Decide whether OAuth stays demo-only or gets a real token exchange implementation.
