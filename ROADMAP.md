# CareerLog — Product Roadmap

_Last updated: 2026-06-25_

This roadmap is grounded in an audit of the backend (`backend-app-tracker/`) and
desktop client (`careerlog-desktop/`). It captures **what the product does today**,
then the prioritized work ahead. Items are tagged by area and rough priority
(**P0** critical → **P3** nice-to-have) and status (✅ done · 🟡 partial · ⬜ open).

> **Status note:** A remediation pass on 2026-06-25 closed most P0–P2 backend
> items. A `mongomock`-backed test harness was added (`tests/conftest.py`) so the
> suite runs with **no external Mongo**, and `ruff` now gates CI. Backend: 10
> tests passing + lint clean; desktop renderer typechecks clean.

---

## 1. What CareerLog Does Today (v1, shipped)

- **Auth** — register / login / refresh issuing 2-hour HS256 JWTs; Argon2 password
  hashing; per-user data isolation via JWT `sub`.
- **Jobs** — full CRUD with JSON or multipart; résumé upload/replace/download via
  GridFS (now type/size validated); free-text **notes**; pagination, sorting, and
  whitelisted filters on list.
- **Alerts** — CRUD for follow-up reminder records (**configuration only — never
  delivered**).
- **Analytics** — job status-count aggregation feeding the dashboard.
- **Users** — get / update / delete self (ownership-enforced, service-layered).
- **Desktop client** — Electron + React app with login, dashboard (stat grid +
  pipeline), jobs table/forms (incl. notes), and alerts; hardened Electron shell
  with auto-update via GitHub Releases.

---

## 2. ✅ Completed in the 2026-06-25 pass

| ID | Area | What changed |
| --- | --- | --- |
| SEC-1 | Security | `filters` is now whitelisted per resource, forces `userId` last, and rejects Mongo operators / operator-object values. Closes the IDOR + injection hole. (`app/common/query.py`) + tests. |
| SEC-2 | Security | CORS no longer uses `"*"`; origins come from `Settings.cors_allow_origins` (defaults to the Vite dev origin). |
| SEC-7 | Security | Résumé uploads validated: allowed MIME types (`pdf/doc/docx/txt`) and ≤5MB, on both create & update. + tests. |
| BUG-1 | Correctness | Frontend auth types corrected to the real `{ user, jwt, expiresAt }`; `saveAuthToken` now consumes the ISO `expiresAt` (was reading a non-existent `expiresIn` → `NaN` expiry). Signup now uses its own returned session (no redundant login). |
| BUG-2 | Correctness | `test_create_and_list_jobs` fixed to send required `company`; tests added for the validation envelope. |
| BUG-3 | Correctness | Analytics `denied` → `rejected`; response now validated through `JobStatusCounts`. |
| BUG-4 | Correctness | Global exception handlers normalize **all** errors (incl. FastAPI/pydantic validation) to the bare envelope; validation adds `error.details: [{field, message}]`. |
| BUG-5 | Correctness | Résumé ownership error standardized to `RESOURCE_OWNERSHIP_VIOLATION`. |
| BUG-6 | Correctness | `fetchJobResume` param renamed `resumeId` (it was always passed the résumé id — naming only). |
| CLN-1 | Cleanup | Duplicated `parse_filters` + pagination extracted to shared `app/common/query.py`. |
| CLN-2 | Cleanup | Users domain given a real service layer (`app/users/service.py`); route now thin. |
| CLN-3 | Cleanup | `ensure_indexes()` creates all documented indexes on startup (FastAPI lifespan). |
| CLN-4 | Cleanup | Deprecated `.dict()` → `.model_dump()`; `config.py` migrated to `SettingsConfigDict`. |
| CLN-6 | Cleanup | Unused imports removed (ruff autofix). |
| CLN-7 | Cleanup | `ruff` added to CI (`ruff.toml`, `F`/`E9`) + a lint step in `ci.yml`. |
| FEAT-1 | Feature | Job **notes** field added end-to-end (schema, service, multipart, contract) and wired through the desktop form (config, hook, normalize/diff, help text). + test. |
| TEST | Infra | `tests/conftest.py` rewritten to back the app with `mongomock` (incl. GridFS); suite runs offline. |

---

## 3. ⬜ Remaining Security Hardening

| ID | Pri | Issue | Notes |
| --- | --- | --- | --- |
| SEC-3 | P1 | **No rate limiting / lockout** on `login` & `register`; distinct 401 vs 409 leaks which emails exist. | Needs a limiter dep (e.g. slowapi) + a store; not added to avoid a half-baked in-memory solution under multi-worker gunicorn. |
| SEC-4 | P1 | **No token revocation / refresh rotation** — a leaked token is valid for its full 2h. | Short access token + rotating refresh token, or a server-side denylist. |
| SEC-5 | P2 | **JWT `sub` not re-validated** against the DB; a deleted user's token still works until expiry. | Optional per-request existence check for sensitive ops. |
| SEC-6 | P2 | **`pfp` base64 stored inline** in the user doc — unbounded growth; sent on every `/users/me`. | Move profile images to GridFS (mirror the résumé approach) + size cap. Pairs with FEAT-3. |
| SEC-8 | P2 | **`JWT_SECRET` strength not enforced.** | Fail fast on weak/missing secret in prod. |

---

## 4. ⬜ Remaining Cleanup & Tech Debt

| ID | Pri | Item |
| --- | --- | --- |
| CLN-5 | P2 | **Response models mostly unused.** Analytics now validates via `JobStatusCounts`, but jobs/alerts/users handlers still return raw dicts. Wire `response_model` (envelope-aware) or drop the dead schemas. |
| CLN-8 | P3 | **Naming:** path param `id` vs document field `jobId` (external ref) is confusing. |
| CLN-9 | P2 | **No desktop/renderer tests.** Backend now has a harness; the frontend has none. Add Vitest + React Testing Library for the API client and forms. |
| CLN-10 | P3 | **Pydantic v2 style:** several modules could adopt `ConfigDict`/typed responses more broadly; consider widening the ruff ruleset beyond `F`/`E9` once the codebase is clean. |

---

## 5. ⬜ Next Functionality

### v1.x
- **FEAT-2 (P2): Surface field-level validation in the UI.** The backend now returns
  `error.details`; the desktop client should map these onto form fields.
- **FEAT-3 (P2): Profile-picture upload to GridFS** (pairs with SEC-6) with a real
  upload UI.

### v2 — the headline release (alerts that actually fire)
- **FEAT-4 (P1): Deliver alerts.** Background scheduler (APScheduler/Celery + broker)
  that sends `email`/`sms` at `scheduledAlert` and updates `lastAlertAt`. Biggest gap
  between the stored model and user expectation.
- **FEAT-5 (P2): Email/SMS providers** (SES/SendGrid, Twilio) behind a pluggable
  notifier interface.
- **FEAT-6 (P2): Password reset & email verification** flows.
- **FEAT-7 (P2): Richer analytics** — response rate, time-to-offer, applications over
  time, per-company funnels.

### Product / platform
- **FEAT-8 (P2): Cross-platform builds** — wire up the existing `mac` (dmg) target
  plus Linux, with signing.
- **FEAT-9 (P3): Optional offline caching.**
- **FEAT-10 (P3): Multiple résumés per job** + in-app preview.
- **FEAT-11 (P3): Saved searches / advanced filtering UI** (now safe to build on the
  hardened filter mechanism).

---

## 6. Suggested Sequencing (remaining)

1. **Finish the security sprint:** SEC-3, SEC-4 (P1) → SEC-5/6/8.
2. **Tighten contracts/tests:** CLN-5 response models, CLN-9 desktop tests, FEAT-2.
3. **v2 kickoff:** FEAT-4 alert delivery + providers (FEAT-5).
4. **Platform & polish:** FEAT-8 builds, remaining analytics & cleanup.
