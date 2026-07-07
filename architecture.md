# CareerLog — Architecture

CareerLog is a job-application tracking product split into two independently
deployable repositories that live side by side in this workspace:

| Folder | Role | Stack |
| --- | --- | --- |
| [backend-app-tracker/](backend-app-tracker/) | REST API and source of truth | Python · FastAPI · MongoDB · JWT |
| [careerlog-desktop/](careerlog-desktop/) | Windows-first desktop client | Electron · React · TypeScript · Vite |

The backend owns all data, business logic, and persistence. The desktop app is a
thin, typed client that talks to the backend over HTTP and holds no authoritative
state.

---

## 1. Product

CareerLog helps a job seeker track their applications end to end. A user can:

- **Authenticate** — register, log in, and refresh a session against the backend.
- **Manage job applications** — create, view, update, and delete jobs, each with a
  title, company, URL, location, employment type, salary target/range, status, and
  an optional uploaded résumé file.
- **Track the pipeline** — jobs move through statuses (`applied`,
  `interviewing`, `offer`, `rejected`), surfaced as a dashboard with status counts
  and a pipeline visualization.
- **Configure follow-up alerts** — schedule a reminder (`sms` or `email`) with a
  message and scheduled time. A background scheduler delivers due alerts through a
  pluggable notifier (console by default, SMTP email / Twilio SMS when
  configured) and stamps `lastAlertAt`.
- **Attach résumés** — upload one or more résumés per job; files are stored
  server-side in MongoDB GridFS and downloaded on demand.
- **Go beyond tracking** — score résumé↔job fit, discover and compare postings
  from ATS boards, prep for interviews, research companies, compare offers, and
  triage recruiting email into status changes. These reuse the same backend +
  envelope contract; see the [README](README.md) for the full feature catalogue.
  All matching/discovery uses classic NLP/heuristics — **no generative AI**.

### Explicit non-goals
- No offline authoring — the client holds no authoritative state; a read-only,
  last-cached view (jobs) is the only local persistence.
- No real-time updates / push.
- SMS / email delivery require a configured provider (Twilio / SMTP); without
  one, alerts fall back to the console notifier.
- No business logic in the frontend beyond the API contract.

---

## 2. Tools & Packages

### Backend (`backend-app-tracker`)
- **Python 3.11+**
- **FastAPI 0.127** + **Starlette** — web framework and routing
- **Uvicorn** (dev) / **Gunicorn** (prod) — ASGI servers
- **MongoDB** via **PyMongo 4.15** — primary datastore; **GridFS** for résumé files
- **Pydantic 2.12** + **pydantic-settings** — request/response schemas and config
- **python-jose** — JWT encode/decode (HS256)
- **passlib + argon2-cffi / bcrypt** — password hashing
- **email-validator**, **python-multipart** — validation and multipart uploads
- **slowapi** — per-endpoint rate limiting (SEC-3)
- **pypdf** — résumé PDF text extraction for the matching engine
- **pytest** + **mongomock** — test suite (`tests/`)
- **ruff** — linter (pyflakes + syntax rules; see `ruff.toml`)
- **GitHub Actions** — CI that spins up a `mongo:7` service and runs `pytest`
  ([.github/workflows/ci.yml](backend-app-tracker/.github/workflows/ci.yml))

### Desktop client (`careerlog-desktop`)
- **Electron 39** — desktop runtime (main + preload processes)
- **React 19 + TypeScript 5.9** — UI layer
- **Vite 7** — bundler (stable build; rolldown disabled)
- **React Router 7** (`HashRouter`) — client-side routing
- **Tailwind CSS 3** + PostCSS / Autoprefixer — styling
- **react-hot-toast** — toasts (confirmation dialogs are a small in-house
  `confirmController` — see `components/common/dialogs/`)
- **jspdf** — client-side PDF export of match reports
- **electron-builder** + **electron-updater** — cross-platform packaging &
  auto-update (Windows NSIS, macOS dmg/zip, Linux AppImage/deb)
- **Vitest** + Testing Library — unit/component tests
- **ESLint / typescript-eslint** — linting
- Dev tooling: `concurrently`, `wait-on`, `ts-node`

---

## 3. Backend Architecture

### Layered, feature-sliced layout
Each domain is a self-contained module with three layers — routes (HTTP),
service (logic/data access), and schemas (Pydantic models):

```
app/
├── main.py        # FastAPI app, CORS, exception handlers, router registration
├── config.py      # env-driven settings (Mongo URI, JWT, rate limits, SMTP…)
├── database.py    # lazy singleton MongoClient + get_db() + ensure_indexes()
│
│   # Core tracking
├── auth/          # register / login / refresh / verify-email / reset-password
├── users/         # user profile + avatar (GridFS)
├── jobs/          # job CRUD + résumé multipart handling
├── resumes/       # GridFS résumé download
├── alerts/        # follow-up reminder CRUD + delivery (runner + notifier)
├── analytics/     # dashboard aggregations + source-performance funnel
├── saved_searches/# named, reusable job-list queries
│
│   # Matching & discovery (classic NLP — no generative AI)
├── matching/      # résumé↔job scoring: extract, sections, keywords, taxonomy,
│                  #   scoring, analyze, fetch (SSRF-guarded URL scrape)
├── discovery/     # ATS ingestion (connectors/normalize/enrich) + filtered feed
├── preferences/   # per-user preferred / hidden companies + job types
├── job_alerts/    # saved discovery searches + background match notifications
│
│   # Prep, research & integrations
├── interview_prep/    # deterministic prep-notes / practice-question generator
├── company_research/  # company snapshot derived from discovered postings
├── star_stories/      # behavioral STAR story library (CRUD)
├── offers/            # offer capture + side-by-side comparison (CRUD)
├── email_tracking/    # classify pasted recruiting email → suggested status
│
│   # Support
├── notifications/ # pluggable notifier (console / SMTP email / Twilio SMS)
└── common/
    ├── auth.py       # JWT create/decode + get_current_user dependency
    ├── responses.py  # success()/failure() envelope helpers
    ├── errors.py     # raise_error() standardized error raising
    ├── query.py      # ownership-safe filter parsing + pagination (SEC-1)
    └── ratelimit.py  # slowapi limiter
```

All routers are mounted under `/api/*` in
[app/main.py](backend-app-tracker/app/main.py): `/api/auth`, `/api/users`,
`/api/jobs`, `/api/alerts`, `/api/resumes`, `/api/analytics`,
`/api/saved-searches`, `/api/match`, `/api/discovery`, `/api/preferences`,
`/api/job-alerts`, `/api/email-tracking`, `/api/company-research`,
`/api/interview-prep`, `/api/offers`, `/api/star-stories`, plus an
unauthenticated `/health`. Rate-limit violations and validation/HTTP errors are
normalized to the standard envelope by exception handlers in `main.py`.

### Response envelope (contract)
Every endpoint returns a uniform envelope so the client can treat it as
authoritative:

```json
{ "success": true,  "data": { ... }, "error": null }
{ "success": false, "data": null,    "error": { "code": "...", "message": "..." } }
```

List endpoints (`jobs`, `alerts`, `discovery`) return paginated `data`:
`{ "items": [...], "meta": { page, pageSize, totalItems, totalPages } }`.

### Authentication & ownership
- Login/register issue a JWT (HS256) with a fixed 2-hour expiry, carrying
  `sub` (user id), `email`, issuer `job-tracker-api`, and audience `desktop-client`.
- Protected routes depend on `get_current_user`, which decodes the bearer token and
  returns the `userId` from `sub`.
- **`userId` is never trusted from the request body** — it is always derived from
  the JWT, and every query is scoped to the owning user. This enforces strict
  per-user data isolation.

### Data model (MongoDB)
Collections (see [MONGO_SCHEMA.md](backend-app-tracker/MONGO_SCHEMA.md)). Every
user-owned document carries a `userId` and is queried scoped to it.

_Core tracking (per-user):_
- **`users`** — credentials (`passwordHash` only), profile, optional `pfp`; unique
  index on `email`.
- **`jobs`** — application fields, `status`, notes, and résumé references (GridFS
  file ids). Indexed on `userId`, `status`, `employmentType`, `createdAt`.
- **`alerts`** — follow-up reminders (`scheduledAlert`, `smsOrEmail`, `message`,
  `lastAlertAt`). Indexed on `userId`, `scheduledAlert`.
- **`saved_searches`** — named job-list queries (validated filters + sort).
- **`offers`**, **`star_stories`**, **`user_preferences`** — offers comparison,
  the STAR story library, and preferred/hidden companies + job types.

_Auth:_
- **`auth_tokens`** — hashed, single-use email-verification / password-reset
  tokens (unique `tokenHash`, TTL-expired). Refresh tokens themselves are JWTs
  and are not stored.
- **`revoked_tokens`** — revoked refresh-token ids (`jti`) for logout / rotation
  revocation (TTL-expired).

_Discovery (shared, public postings — not user-scoped):_
- **`discovered_jobs`** — normalized ATS postings keyed by `(source, boardToken,
  sourceId)`, with enrichment (eligibility/quality/dedupe) computed at ingest.
- **`job_alerts`** — saved discovery searches whose `criteria` reuse the live
  Discover filter, checked on a schedule for new matches.

`_id` is the authority; the API exposes `id = _id.toString()`. Résumé files and
avatars are stored in **GridFS** rather than inline.

---

## 4. Desktop Client Architecture

### Process model (Electron)
- **Main process** ([electron/main.ts](careerlog-desktop/electron/main.ts)) —
  creates the `BrowserWindow`, applies a Content-Security-Policy, hardens
  navigation (external links open in the OS browser, deny-by-default permissions),
  locks down DevTools in production, and wires `electron-updater` auto-update.
- **Preload** ([electron/preload.ts](careerlog-desktop/electron/preload.ts)) —
  the only bridge to the renderer via `contextBridge`, exposing a minimal
  `careerlog` API: `appVersion` plus an `updates` channel (subscribe to
  auto-update status, trigger a check, apply a downloaded update).
- **Renderer** — the React app, loaded from the Vite dev server in development or
  the built `dist/index.html` in production.

Security posture: `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true`, no Node APIs in the renderer, and no secrets bundled.

### Renderer structure (`src/`)
```
src/
├── App.tsx            # HashRouter routes, guarded by <AuthGuard>
├── main.tsx           # bootstrap
├── api/               # typed API client (client.ts) + per-domain modules
│                      #   (auth, jobs, alerts, users, analytics, match,
│                      #    discovery, offers, starStories, savedSearches,
│                      #    preferences, jobAlerts, emailTracking,
│                      #    interviewPrep, companyResearch) + offlineCache
├── store/             # UserProvider + auth.ts (JWT/localStorage lifecycle)
├── pages/             # Login, ResetPassword, VerifyEmail, Dashboard, Jobs,
│                      #   Match, Discovery, Compare, Alerts, EmailTracking,
│                      #   Sources, CompanyResearch, InterviewPrep, Offers,
│                      #   Stories, Profile
├── components/        # auth, common (dialogs, guards, menus, UpdateBanner),
│                      #   dashboard, jobs (table/toolbar/job-form), discovery,
│                      #   match
├── lib/               # framework-free helpers (matchReport[+Pdf], alertStatus)
├── layouts/           # AppLayout
└── types/             # API/domain types, one module per feature
```

### API client
[src/api/client.ts](careerlog-desktop/src/api/client.ts) is the single HTTP
chokepoint. It:
- Injects the `Authorization: Bearer <jwt>` header from the in-memory token
  (falling back to `localStorage`).
- Handles both JSON and `FormData` (multipart résumé uploads), letting the browser
  set multipart boundaries.
- Unwraps FastAPI `detail`-wrapped errors back into the standard envelope.
- Treats `success === false` as a failure and throws a typed `ApiError`
  (carrying backend `code` + HTTP status), surfacing backend messages verbatim.
- On `401` (outside the auth endpoints), attempts a single silent, single-flight
  refresh and retries once; if refresh fails, clears the token and redirects to
  `#/login`.

Routing is hash-based (`HashRouter`) so it works from `file://` in the packaged
app, with all routes except `/login` wrapped in an `AuthGuard`.

---

## 5. End-to-End Pipeline

```
┌─────────────────────────── careerlog-desktop (Electron) ───────────────────────────┐
│                                                                                     │
│  Renderer (React)                                                                   │
│   Pages ─▶ api/* modules ─▶ api/client.ts ──┐                                        │
│     ▲                                        │  fetch + Bearer JWT (JSON/multipart)  │
│     │ localStorage (careerlog_token)         │                                       │
│   store/auth.ts                              │                                       │
│                                              ▼                                       │
└──────────────────────────────────────────── │ ─────────────────────────────────────┘
                                               │  HTTPS  (default dev: 127.0.0.1:8000)
┌──────────────────────────────────────────── ▼ ─────────────────────────────────────┐
│  backend-app-tracker (FastAPI)                                                      │
│                                                                                     │
│   CORS ─▶ /api/<domain> router                                                      │
│              │                                                                       │
│              ├─ Depends(get_current_user) ──▶ decode JWT ──▶ userId (sub)            │
│              │                                                                       │
│              ▼                                                                       │
│           service layer  ──▶  PyMongo / GridFS                                       │
│              │                       │                                               │
│              ▼                       ▼                                               │
│        success()/failure()     MongoDB (users / jobs / alerts + GridFS files)       │
│           envelope                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**Request lifecycle (example: create a job with a résumé)**
1. User submits the job form; the renderer builds `FormData` and calls
   `apiClient.post("/api/jobs/", formData)`.
2. `client.ts` attaches the bearer JWT and POSTs as `multipart/form-data`.
3. FastAPI's CORS middleware passes the request to the jobs router, which resolves
   `get_current_user` to obtain the `userId` from the token.
4. The route streams the résumé into **GridFS**, validates the payload via the
   Pydantic `CreateJobRequest`, and calls `service.create_job`.
5. The service inserts a `jobs` document scoped to `userId` (with the GridFS file
   id as `resume`) and returns the new `id` + timestamps.
6. The route wraps the result in `success(data=...)`; the client unwraps the
   envelope and returns typed `data` to the UI.

**Dashboard analytics** follow the same path but read-only: the `/api/analytics/
status-counts` endpoint runs a MongoDB aggregation grouping the user's jobs by
`status`, feeding the dashboard's stat grid and pipeline visualization.

**Auth flow**: login/register return `{ user, jwt, expiresAt }`; the client stores
the token + expiry in `localStorage`, and `/api/auth/refresh` re-issues a token from
an existing valid one.

---

## 6. Environment & Operations

**Backend** (`.env`):
```
MONGODB_URI=mongodb://localhost:27017/jobtracker
MONGODB_DB_NAME=jobtracker
JWT_SECRET=<secret, min 16 chars>
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=2
REFRESH_TOKEN_EXPIRY_DAYS=7
ALERTS_ENABLED=true
ALERTS_POLL_SECONDS=60
# SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM  (optional email)
```
Run: `uvicorn app.main:app --reload` → `http://localhost:8000` (docs at `/docs`).
The alert scheduler starts with the app (FastAPI lifespan) when `ALERTS_ENABLED`.
Test: `pytest`. CI runs the suite against a `mongo:7` service on every push/PR to
`main`.

**Desktop client**:
- `VITE_API_BASE_URL` configures the backend base URL.
- `npm run dev` — Vite dev server + Electron with hot reload.
- `npm run build` / `npm run dist` — compile main/preload, build the renderer, and
  package the app via electron-builder (Windows NSIS, macOS dmg/zip, Linux
  AppImage/deb; publishes to GitHub releases for auto-update).
- `npm test` — Vitest unit/component suite.

---

## 7. Versioning & Contracts

The frontend targets **CareerLog API v1**. The request/response shapes are pinned in
the backend's [API_CONTRACT.md](backend-app-tracker/API_CONTRACT.md) and
[MONGO_SCHEMA.md](backend-app-tracker/MONGO_SCHEMA.md). Breaking frontend changes
must align with backend versioning; the uniform response envelope and pagination
contract are the stable seam between the two repositories.
