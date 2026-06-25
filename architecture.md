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
  message and scheduled time. In v1 alerts are **configuration-only**: the backend
  stores them but does not actually send messages or run background jobs.
- **Attach résumés** — upload a résumé per job; files are stored server-side in
  MongoDB GridFS and downloaded on demand.

### Explicit non-goals (v1)
- No local authoritative data storage on the client (no offline mode).
- No real-time updates / push.
- No actual SMS/email delivery or scheduled background execution.
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
- **pytest** — test suite (`tests/`)
- **GitHub Actions** — CI that spins up a `mongo:7` service and runs `pytest`
  ([.github/workflows/ci.yml](backend-app-tracker/.github/workflows/ci.yml))

### Desktop client (`careerlog-desktop`)
- **Electron 39** — desktop runtime (main + preload processes)
- **React 19 + TypeScript 5.9** — UI layer
- **Vite 7** — bundler (stable build; rolldown disabled)
- **React Router 7** (`HashRouter`) — client-side routing
- **Tailwind CSS 3** + PostCSS / Autoprefixer — styling
- **react-hot-toast** + **react-confirm** — toasts and confirmation dialogs
- **electron-builder** + **electron-updater** — Windows (NSIS) packaging & auto-update
- **ESLint / typescript-eslint** — linting
- Dev tooling: `concurrently`, `wait-on`, `ts-node`

---

## 3. Backend Architecture

### Layered, feature-sliced layout
Each domain is a self-contained module with three layers — routes (HTTP),
service (logic/data access), and schemas (Pydantic models):

```
app/
├── main.py        # FastAPI app, CORS, health check, router registration
├── config.py      # env-driven settings (Mongo URI, JWT secret/algorithm/expiry)
├── database.py    # lazy singleton MongoClient + get_db()
├── auth/          # register / login / refresh  → issues JWTs
├── users/         # user profile endpoints
├── jobs/          # job CRUD + résumé multipart handling
├── alerts/        # alert CRUD (config-only)
├── resumes/       # GridFS résumé download
├── analytics/     # aggregation (status counts) for the dashboard
└── common/
    ├── auth.py        # JWT create/decode + get_current_user dependency
    ├── responses.py   # success()/failure() envelope helpers
    └── errors.py      # raise_error() standardized error raising
```

All routers are mounted under `/api/*` in
[app/main.py](backend-app-tracker/app/main.py): `/api/auth`, `/api/users`,
`/api/jobs`, `/api/alerts`, `/api/resumes`, `/api/analytics`, plus an unauthenticated
`/health`.

### Response envelope (contract)
Every endpoint returns a uniform envelope so the client can treat it as
authoritative:

```json
{ "success": true,  "data": { ... }, "error": null }
{ "success": false, "data": null,    "error": { "code": "...", "message": "..." } }
```

List endpoints (`jobs`, `alerts`) return paginated `data`:
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
Three collections (see
[MONGO_SCHEMA.MD](backend-app-tracker/MONGO_SCHEMA.MD)):
- **`users`** — credentials (`passwordHash` only), profile, optional `pfp`; unique
  index on `email`.
- **`jobs`** — owned by `userId`, application fields, `status`, and a `resume`
  reference (GridFS file id). Indexed on `userId`, `status`, `employmentType`,
  `createdAt`.
- **`alerts`** — owned by `userId`, `scheduledAlert`, `smsOrEmail`, `message`,
  `lastAlertAt`. Indexed on `userId`, `scheduledAlert`.

`_id` is the authority; the API exposes `id = _id.toString()`. Résumé files are
stored in GridFS rather than inline.

---

## 4. Desktop Client Architecture

### Process model (Electron)
- **Main process** ([electron/main.ts](careerlog-desktop/electron/main.ts)) —
  creates the `BrowserWindow`, applies a Content-Security-Policy, hardens
  navigation (external links open in the OS browser, deny-by-default permissions),
  locks down DevTools in production, and wires `electron-updater` auto-update.
- **Preload** ([electron/preload.ts](careerlog-desktop/electron/preload.ts)) —
  the only bridge to the renderer via `contextBridge`, exposing a minimal
  `careerlog` API (currently just `appVersion`).
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
│                      #   auth, jobs, alerts, users, analytics
├── store/auth.ts      # JWT persistence in localStorage + token lifecycle
├── pages/             # Login, Dashboard, Jobs, Alerts
├── components/        # auth, common (dialogs, guards, menus),
│                      #   dashboard (stats, pipeline, recent jobs, alerts),
│                      #   jobs (table, toolbar, pagination, job-form)
├── layouts/           # AppLayout
└── types/             # API/domain types (job, alert, user, analytics)
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
- On `401`, clears the token and redirects to `/login`.

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
JWT_SECRET=<secret>
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=2
```
Run: `uvicorn app.main:app --reload` → `http://localhost:8000` (docs at `/docs`).
Test: `pytest`. CI runs the suite against a `mongo:7` service on every push/PR to
`main`.

**Desktop client**:
- `VITE_API_BASE_URL` configures the backend base URL.
- `npm run dev` — Vite dev server + Electron with hot reload.
- `npm run build` / `npm run dist` — compile main/preload, build the renderer, and
  package a Windows NSIS installer via electron-builder (publishes to GitHub
  releases for auto-update).

---

## 7. Versioning & Contracts

The frontend targets **CareerLog API v1**. The request/response shapes are pinned in
the backend's [API_CONTRACT.MD](backend-app-tracker/API_CONTRACT.MD) /
[API_CONTRACT_V2.MD](backend-app-tracker/API_CONTRACT_V2.MD) and
[MONGO_SCHEMA.MD](backend-app-tracker/MONGO_SCHEMA.MD). Breaking frontend changes
must align with backend versioning; the uniform response envelope and pagination
contract are the stable seam between the two repositories.
