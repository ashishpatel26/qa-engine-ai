# QA Engine Project Review

Date: 2026-06-11

Scope: Full checked-out project review of the React/Vite frontend, Python FastAPI backend, PRD alignment, build/lint/dependency checks, and visible UX/design implementation.

## Multi-Agent Workflow Used

| Lane | Owner | Scope | Output Used |
|---|---|---|---|
| Orchestrator | Main Codex session | Repo map, verification commands, evidence consolidation, final review file | This document |
| Frontend/design explorer | Sub-agent Avicenna | `src/`, JSX, CSS, design consistency, UI behavior | Frontend findings merged below |
| Backend/API explorer | Sub-agent Kant | `server.py`, `pyproject.toml`, API behavior, security/runtime risks | Backend findings merged below |

## Verification Summary

| Check | Result | Evidence | Notes |
|---|---:|---|---|
| Frontend production build | Working | `cmd.exe /C npm run build` completed successfully | Built `dist/index.html`, CSS, and JS assets. Linux-side `npm` fails under WSL 1, but Windows command bridge works. |
| Frontend lint | Not working | `cmd.exe /C npm run lint` failed with 24 errors | Mostly unused React imports/props and empty catch blocks. |
| NPM dependency audit | Working | `cmd.exe /C npm audit --audit-level=moderate` returned `found 0 vulnerabilities` | Audit passed at moderate threshold. |
| NPM dependency tree | Partial | `cmd.exe /C npm ls --depth=0` succeeded but reported extraneous packages | Extraneous packages include `@emnapi/*`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`, and `tslib`. |
| Backend syntax compile | Working | `cmd.exe /C "D:\Projects\QAEngine\.venv\Scripts\python.exe" -m py_compile server.py` passed | No Python syntax errors found. |
| Backend app import | Working | Import printed `QA Engine Backend` | FastAPI app imports successfully from the project venv. |
| Backend TestClient smoke | Not working | FastAPI `TestClient` failed: Starlette requires `httpx2` | Add backend dev/test dependencies. |
| Direct backend function smoke | Partial | `get_status`, `post_chat`, `apply_fix`, and `detect_ollama_models` executed | Confirms code paths run, but not as real HTTP integration tests. |

## Project Review Table

| Area | Status | What Is Working | What Is Not Working / Risk | Design Issue | Evidence | Recommendation |
|---|---|---|---|---|---|---|
| Product implementation vs PRD | Partial | Current repo has a polished Vite/React command-center prototype and a FastAPI mock backend. | The PRD describes a full model-agnostic CLI/desktop AI coding assistant with agent runtime, file operations, command execution, tests, PR review, persistence, and provider routing; most of that is not implemented. | Product expectations are much larger than current surface. | `PRD.md`, `src/App.jsx`, `server.py`, `pyproject.toml` | Mark this as prototype/MVP in docs, or reduce PRD scope into staged milestones. |
| README accuracy | Design issue | Project can be built with Vite scripts. | README is still the default React + Vite template and does not explain QA Engine, backend setup, Windows/WSL caveat, or available mock behavior. | Poor onboarding and misleading project identity. | `README.md:1` | Replace with real setup, scripts, architecture, known limitations, and demo-mode notes. |
| Frontend build | Working | Production build succeeds. | None found in build path. | Build success can hide lint/React warnings because Vite still emits bundles. | `package.json:6`, command result | Keep build in CI, but require lint before merge. |
| Frontend lint | Not working | ESLint is configured and runnable. | 24 lint errors currently fail the project. | Code quality gate is red. | `package.json:9`, lint output, `src/App.jsx:1`, `src/components/SettingsPane.jsx:112` | Remove unused imports/props, fix empty catches, or tune ESLint for the React JSX transform. |
| React JSX validity | Partial | App builds despite JSX issues. | Multiple JSX nodes use `class` instead of `className`, and `autocomplete` instead of `autoComplete`. | Browser console and React warnings reduce polish and may break expectations. | `src/components/Layout.jsx:136`, `src/components/WorkspacePane.jsx:77`, `src/components/TerminalPane.jsx:204` | Replace invalid JSX attributes throughout components. |
| Main app state | Partial | Navigation, active view, mock files, terminal logs, model selection, and fix state work locally. | Most state is in memory only; refresh resets user progress. | Prototype feels interactive but not persistent. | `src/App.jsx:14`, `src/App.jsx:39`, `src/App.jsx:61` | Add persistence for sessions/settings or clearly label as demo state. |
| Backend status sync | Partial | Frontend fetches `/api/status` and hydrates some service/fix state. | Offline backend silently falls back to mock states. | Users may believe real backend state exists when it does not. | `src/App.jsx:77`, `src/App.jsx:93` | Show backend offline state and separate demo fallback from production behavior. |
| Apply fix flow | Partial | Apply buttons update UI and backend `fix_applied`. | No real file patch is applied; failures can still mark fix as applied. | Misleading "fixed" state. | `src/App.jsx:96`, `src/App.jsx:112`, `server.py:330` | Implement real patch preview/apply workflow or label as simulation. |
| Chat | Not working | Chat box sends input and receives canned responses. | No real LLM call, streaming, file awareness, tool use, command execution, or model provider abstraction. | Looks like an AI coding assistant but behaves like a keyword demo. | `src/App.jsx:199`, `server.py:433` | Build provider abstraction, streaming response path, and explicit tool permission model. |
| Terminal | Partial | UI accepts commands like `help`, `clear`, and mocked test commands. | It does not execute real shell commands; output is canned. | Terminal affordance implies real CLI functionality. | `src/App.jsx:139`, `src/components/TerminalPane.jsx:1` | Rename to "Demo Console" or connect to a sandboxed command execution backend. |
| Workspace explorer/editor | Partial | File tabs, mock code view, close tab, and suggestion UI work locally. | It does not read actual project files and shows imaginary files like `ReviewAgent.js`, `agent.ts`, and fake package metadata. | Strong IDE visual language but not a real editor. | `src/components/WorkspacePane.jsx:15`, `src/components/WorkspacePane.jsx:67`, `src/components/WorkspacePane.jsx:102` | Connect to filesystem APIs or clearly mark the data as sample workspace content. |
| Test suites/results | Partial | Test suite and result pages are visually complete and respond to `fixApplied`. | Counts, coverage, failures, and frameworks are hardcoded; no real Jest/Playwright/Cypress integration exists. | Good dashboard composition but not truthful telemetry. | `src/components/SuitesPane.jsx:1`, `src/components/ResultsPane.jsx:1` | Back the tables with real test-run records and show "sample data" until then. |
| Debug view | Partial | Root-cause and diff layout are polished. | Diff and regression generation are static; "Generate Regression" is an alert. | Great prototype for flow, but actions do not affect files/tests. | `src/components/DebugPane.jsx:41`, `src/components/DebugPane.jsx:117` | Wire to patch/test generation services or disable unfinished actions. |
| Monitor dashboard | Partial | Agent cards and metrics provide a polished dashboard. | Agent/token/security data is static and includes fake vulnerability information. | Could mislead users about real agent activity/security state. | `src/components/MonitorPane.jsx:7`, `src/components/MonitorPane.jsx:112` | Use live telemetry or mark as demo data. |
| Settings OAuth UI | Partial | OAuth popup flow, polling, localStorage fallback, and connected-card UI exist. | Closed popup after 4 seconds can become mock success, not verified provider auth. | UX says "Secure and instant" even when result may be simulated. | `src/components/SettingsPane.jsx:124`, `src/components/SettingsPane.jsx:170`, `src/components/SettingsPane.jsx:451` | Remove time-based success heuristic outside demo mode; require verified callback/token exchange. |
| API key settings | Risk | API key fields and toggles render. | OpenAI field is prefilled with a secret-looking placeholder; save only triggers an alert; claim of keychain storage is not true. | Trust issue in security-sensitive settings. | `src/components/SettingsPane.jsx:403`, `src/components/SettingsPane.jsx:526`, `src/components/SettingsPane.jsx:668` | Do not prefill keys; implement secure storage or say settings are unsaved mock values. |
| Provider connection state | Risk | Connect/disconnect UI updates local state. | Frontend `handleConnectService` marks service connected on fetch failure; backend accepts arbitrary service names. | Connection badges may be false positives. | `src/App.jsx:118`, `src/App.jsx:130`, `server.py:335` | Validate service enum server-side and show failure states client-side. |
| Backend route registration | Working | API routes and static mount import successfully. | Static mount depends on `dist` existing at import time. | API and static hosting are tightly coupled. | `server.py:15`, `server.py:454` | Make static serving configurable for API-only/dev deployments. |
| Backend state management | Risk | Simple global state supports demo behavior. | Global `app_state` and `oauth_sessions` are process-wide, volatile, and not per user. | Cross-user leakage and reset-on-restart risks. | `server.py:27`, `server.py:44` | Add session/user storage, TTL cleanup, and persistence. |
| OAuth backend callback | Risk | Callback page renders and updates session state. | Callback marks any known state plus code as completed; no token exchange or provider verification occurs. | Security-critical flow is simulated. | `server.py:127`, `server.py:147`, `server.py:151` | Exchange code for tokens, verify user info, bind provider to state, and fail closed. |
| OAuth state and PKCE exposure | Risk | PKCE verifier is generated and stored. | `/api/oauth/{service}/status` returns the whole session, including `code_verifier`; service mismatch is not rejected. | Leaks sensitive OAuth material. | `server.py:81`, `server.py:167`, `server.py:170` | Return only sanitized status/user fields and verify `session.service == service`. |
| OAuth browser messaging | Risk | Popup posts result to opener and localStorage. | `postMessage` target is `'*'`; localStorage contains auth result payload. | Weak origin boundary for auth UX. | `server.py:313`, `server.py:316` | Use a specific target origin and minimize/avoid localStorage for auth results. |
| Ollama detection | Partial / Risk | Localhost probe returns a model list for demo use. | User-controlled host is fetched server-side, creating SSRF risk; localhost failures return fake success. | Detection may show connected when Ollama is not running. | `server.py:404`, `server.py:411`, `server.py:419` | Validate/allowlist hosts; return real errors unless demo mode is explicit. |
| API key verification endpoints | Partial | OpenAI/Anthropic key format checks and provider model calls exist. | Generic exceptions are returned to clients, which may expose implementation/network details. | Error UX may be noisy and insecure. | `server.py:354`, `server.py:373`, `server.py:377`, `server.py:398` | Sanitize client errors and log details server-side. |
| CORS | Partial | Local Vite/dev origins are allowed. | CORS origins are hardcoded and credentials are enabled. | Not production-ready or desktop-ready. | `server.py:18`, `server.py:20` | Move CORS config to env and avoid credentials unless required. |
| Test infrastructure | Not working | Build and lint scripts exist. | No frontend unit/e2e tests are configured; backend TestClient cannot run due missing `httpx2`; no real test script exists. | QA product lacks test coverage for its own core flows. | `package.json:6`, `pyproject.toml:7`, TestClient command failure | Add Vitest/Playwright and backend tests for auth, chat, Ollama, and state validation. |
| Dependency hygiene | Partial | `npm audit` reports 0 vulnerabilities. | `npm ls --depth=0` reports extraneous packages. | Dependency tree should be clean for reproducible installs. | `package-lock.json`, command result | Reinstall/prune dependencies and commit clean lockfile state. |
| Favicon/assets | Design issue | Public assets exist. | `index.html` points favicon to `/vite.svg`, but public asset is `favicon.svg`. | QA Engine branding is undermined by Vite remnants. | `index.html:5`, `public/favicon.svg` | Change favicon path and remove unused starter assets if not needed. |
| Fonts/icons | Partial | Google fonts and Material Symbols render when online. | App depends on external CDN fonts/icons. | Offline/desktop packaging may lose icons or typography. | `index.html:9`, `index.html:10` | Bundle fonts/icons or provide robust local fallbacks. |
| Visual design consistency | Design issue | Dense IDE-style dark UI is generally coherent and polished. | Settings uses large rounded cards/glows while theme favors tight IDE radii; many hardcoded colors bypass tokens. | Some surfaces feel like separate design systems. | `src/index.css:63`, `src/components/SettingsPane.jsx:203` | Consolidate tokens/radii and align Settings with the core IDE shell. |
| Accessibility | Design issue | Some real buttons include titles. | Many clickable `div`, `span`, and `a` elements lack semantic roles, hrefs, keyboard behavior, and aria labels. | Keyboard and screen-reader users will struggle. | `src/components/Layout.jsx:112`, `src/components/ResultsPane.jsx:9`, `src/components/TerminalPane.jsx:136` | Use semantic buttons/nav links and audit keyboard-only flows. |
| Responsive layout | Design issue | Layout is strong on desktop. | Fixed sidebars, dense grids, and 12-column tables are likely poor on mobile/tablet. | Mobile view can clip or squeeze content. | `src/components/WorkspacePane.jsx:193`, `src/components/ResultsPane.jsx:47`, `src/components/SuitesPane.jsx:92` | Add breakpoints, collapsible secondary panes, and table overflow handling. |
| Direct DOM mutation | Risk | Patch button visual state changes work. | `ChatPane` mutates button DOM using `disabled`, `innerHTML`, and `className`. | Imperative DOM work can desync from React state. | `src/components/ChatPane.jsx:32`, `src/components/ChatPane.jsx:41` | Model button state in React state and render declaratively. |
| Git/worktree visibility | Partial | Files are available for review. | `git status --short` failed because this checkout is not recognized as a Git repo from the workspace. | Cannot assess uncommitted changes/history. | Command result | Restore usable `.git` metadata or run review in a normal clone for change-aware audits. |

## Highest Priority Fixes

| Priority | Item | Why |
|---:|---|---|
| 1 | Decide and document prototype vs production scope | Most "working" flows are mock/demo flows; this must be explicit before users trust it. |
| 2 | Fix lint and JSX attribute issues | This is the immediate red quality gate and easiest cleanup. |
| 3 | Remove false-success fallbacks | Apply/connect/OAuth/Ollama should not silently succeed when real work failed. |
| 4 | Harden OAuth and provider settings | Current OAuth flow fabricates success and exposes sensitive PKCE verifier data. |
| 5 | Add real tests | The project is a QA engine but currently lacks its own frontend/backend test coverage. |
| 6 | Align design system and accessibility | The UI is visually promising, but needs semantic controls, responsive behavior, and consistent tokens. |

## Overall Assessment

QA Engine currently looks like a polished desktop-style prototype for an AI QA/coding assistant. The frontend build works and many flows are interactive, but most product-critical behavior is simulated. The backend imports and basic direct functions run, yet its state, OAuth, provider, chat, and Ollama paths are mock-oriented and not production safe.

Recommended next phase: rename the current state as "Demo Prototype", fix lint/JSX, add explicit demo-mode flags, then implement one real vertical slice end to end: provider authentication, real chat response, file read context, patch preview, test execution, and persisted run result.
