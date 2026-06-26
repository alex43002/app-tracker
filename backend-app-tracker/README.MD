# CareerLog — Backend API

This folder (`backend-app-tracker/`) is the **backend REST API** for CareerLog, a
job-application tracker. It's a **FastAPI + MongoDB** service with JWT auth that
owns all data persistence and business logic; the desktop client in
[`../careerlog-desktop/`](../careerlog-desktop) is a thin consumer of this API.

**What it provides**

- **Auth** — register / login / refresh with rotating access + refresh tokens,
  Argon2 password hashing, password reset & email verification.
- **Jobs** — CRUD with JSON or multipart, GridFS résumé upload/download, and
  **multiple résumés per job**, free-text notes, whitelisted filters + pagination.
- **Alerts** — follow-up reminders delivered by a background scheduler via a
  pluggable notifier (console / SMTP email / Twilio SMS, with retry + backoff).
- **Analytics** — status counts, funnel + conversion rates, applications over
  time, time-to-offer, per-company breakdown, and a combined summary endpoint.
- **Saved searches** — named, reusable job-list queries.

The authoritative API and data contracts live in
[`API_CONTRACT_V2.MD`](API_CONTRACT_V2.MD) and [`MONGO_SCHEMA.MD`](MONGO_SCHEMA.MD).

---

## Requirements

- **Python 3.11+**
- **pip**
- **MongoDB** — a local instance (see [Docker](#running-mongodb-locally-via-docker)
  below) or a hosted Atlas cluster. _Not required to run the test suite_, which is
  backed by an in-memory `mongomock`.
- **Git**

---

## Running it locally

### 1. Create and activate a virtual environment

```bash
cd backend-app-tracker
python -m venv .venv
source .venv/bin/activate    # macOS/Linux
.venv\Scripts\activate       # Windows (PowerShell)
```

### 2. Install dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configure environment variables

Create a `.env` file in `backend-app-tracker/`:

```env
# Required
MONGODB_URI=mongodb://localhost:27017/jobtracker
MONGODB_DB_NAME=jobtracker
JWT_SECRET=change-me-to-a-long-random-string   # >= 16 chars, not a known placeholder
JWT_EXPIRY_HOURS=2

# Optional — alert delivery (defaults to logging via the console notifier)
ALERTS_ENABLED=true
ALERTS_POLL_SECONDS=60

# Optional — notifier delivery hardening (retry + backoff before dead-lettering)
NOTIFIER_MAX_ATTEMPTS=3
NOTIFIER_RETRY_BACKOFF_SECONDS=0.5

# Optional — email alerts via SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=...
SMTP_FROM=no-reply@careerlog.app

# Optional — SMS alerts via Twilio (all three required to enable SMS)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM=+15551234567
```

If a required variable is missing or invalid, the app prints an actionable
checklist and exits instead of starting with a broken config.

### 4. Run the API

```bash
uvicorn app.main:app --reload
```

The API is served at `http://localhost:8000`, with interactive docs at
`http://localhost:8000/docs` and a health check at `GET /health`.

### 5. Run the tests

```bash
pytest          # 73 tests, offline (mongomock — no MongoDB needed)
ruff check .    # lint
```

---

## Running MongoDB locally via Docker

If you don't have MongoDB installed, the quickest way to get a local instance is
Docker. The `MONGODB_URI` above (`mongodb://localhost:27017/jobtracker`) matches
these defaults.

### Option A — one-off container

```bash
docker run -d \
  --name careerlog-mongo \
  -p 27017:27017 \
  -v careerlog-mongo-data:/data/db \
  mongo:7
```

- `-d` runs it detached; `-p 27017:27017` exposes the default Mongo port.
- `-v careerlog-mongo-data:/data/db` persists data in a named volume across
  restarts.

Manage it with:

```bash
docker stop careerlog-mongo      # stop
docker start careerlog-mongo     # start again
docker rm -f careerlog-mongo     # remove (data survives in the volume)
docker logs -f careerlog-mongo   # tail logs
```

### Option B — docker-compose

Create `docker-compose.yml` in `backend-app-tracker/`:

```yaml
services:
  mongo:
    image: mongo:7
    container_name: careerlog-mongo
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db

volumes:
  mongo-data:
```

Then:

```bash
docker compose up -d      # start
docker compose down       # stop (add -v to also delete the data volume)
```

> The app creates the documented indexes on startup, so no manual database
> setup is needed — just point `MONGODB_URI` at the running instance. To inspect
> data, connect with `mongosh "mongodb://localhost:27017/jobtracker"` or a GUI
> like MongoDB Compass.

---

## Project structure

```
backend-app-tracker/
├── app/
│   ├── main.py            # FastAPI app, routers, exception handlers, lifespan
│   ├── config.py          # Settings (pydantic) + fail-fast validation
│   ├── database.py        # Mongo client + ensure_indexes()
│   ├── auth/              # register / login / refresh / reset / verify
│   ├── users/             # self get / update / delete, profile picture
│   ├── jobs/              # job CRUD + résumé sub-resource
│   ├── resumes/           # résumé download / inline preview
│   ├── alerts/            # alert CRUD + background scheduler (runner.py)
│   ├── analytics/         # funnel, over-time, time-to-offer, by-company, summary
│   ├── saved_searches/    # named, reusable job-list queries
│   ├── notifications/     # pluggable notifier (console / SMTP / Twilio + retry)
│   └── common/            # auth deps, query/filter helpers, errors, rate limit
├── tests/                 # pytest suite (mongomock-backed, runs offline)
├── requirements.txt
├── ruff.toml
├── API_CONTRACT_V2.MD     # authoritative REST contract
├── MONGO_SCHEMA.MD        # document schemas + indexes
└── .github/workflows/     # CI (ruff + pytest)
```

---

## Project goals

- Strict adherence to the API contract with symmetric request/response schemas
- JWT-based authentication and per-user data isolation
- MongoDB as the source of truth
- Hardened, whitelisted query/filter mechanism (no IDOR / operator injection)
