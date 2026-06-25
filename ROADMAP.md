# CareerLog — Product Roadmap

_Last updated: 2026-06-25_

This roadmap is grounded in an audit of the backend (`backend-app-tracker/`) and
desktop client (`careerlog-desktop/`). It captures **what the product does today**,
then the prioritized work ahead. Items are tagged by area and rough priority
(**P0** critical → **P3** nice-to-have) and status (✅ done · 🟡 partial · ⬜ open).

> **Status note:** Remediation passes on 2026-06-25 closed **all P0–P1** and most
> P2 items, including the full access/refresh **token-rotation** flow (SEC-4) across
> backend + desktop. The backend has a `mongomock`-backed harness (runs with **no
> external Mongo**) gated by `ruff`; the desktop client has a `vitest` harness and
> its own CI. **All P0–P2 items are now complete.** Current state: **backend 25
> tests + ruff clean; desktop 16 tests + typecheck + eslint clean.** Remaining work
> is the larger v2 features (alert delivery) and P3 items (response-model validation,
> residual lint warnings, enumeration hardening).

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

## 2. ✅ Completed (2026-06-25)

| ID | Area | What changed |
| --- | --- | --- |
| SEC-1 | Security | `filters` is now whitelisted per resource, forces `userId` last, and rejects Mongo operators / operator-object values. Closes the IDOR + injection hole. (`app/common/query.py`) + tests. |
| SEC-2 | Security | CORS no longer uses `"*"`; origins come from `Settings.cors_allow_origins` (defaults to the Vite dev origin). |
| SEC-3 | Security | Rate limiting on `login`/`register` via `slowapi` (`Settings.auth_rate_limit`, default 5/min); throttled responses use the standard `RATE_LIMITED` envelope. + test. |
| SEC-4 | Security | **Token rotation.** Short-lived **access** tokens + long-lived **refresh** tokens (typed via a `type` claim, `jti` per refresh). `/refresh` rotates and revokes the presented token (`revoked_tokens` collection + TTL index); replay is rejected. Added `/logout` (revokes a refresh token). Desktop: store persists both tokens, the API client silently refreshes on 401 and retries (single-flight), logout revokes server-side. Backend + desktop tests. |
| SEC-9 | Security | **Refresh-token family revocation.** Replaying an already-rotated refresh token is treated as theft: the user's whole token family is revoked via a per-user `tokenGeneration` (deterministic, no timing dependence). Refresh tokens carry a `gen` claim; stale generations are rejected. + test. |
| FEAT-2 | Feature | **Field-level validation in the UI.** `ApiError` now carries `details`; `displayMessage` formats them; the auth screen surfaces per-field messages (and `AuthError` preserves line breaks). + test. |
| SEC-6 / FEAT-3 | Security + Feature | **Profile pictures → GridFS.** `pfp` moved from inline base64 to a GridFS file id. New `PUT/GET/DELETE /api/users/{id}/pfp` (type/size validated, self-owned). Registration no longer takes `pfp`. Desktop: `UserMenu` resolves the avatar via an object URL and offers click-to-upload; signup no longer sends `pfp`. Backend + desktop tests. |
| CLN-10 | Cleanup | **Desktop lint debt cleared.** Fixed all 11 real eslint errors (`no-explicit-any`, unused vars, `require`-import in preload); downgraded the aggressive react-compiler/react-refresh rules (`set-state-in-effect`, `immutability`, `only-export-components`) to warnings; added `^_` unused-var ignores. Re-enabled the eslint step in desktop CI. `eslint .` now passes (0 errors). |
| SEC-5 | Security | `get_current_user` now re-validates that the user still exists — a token for a deleted account is rejected. + test. |
| SEC-7 | Security | Résumé uploads validated: allowed MIME types (`pdf/doc/docx/txt`) and ≤5MB, on both create & update. + tests. |
| SEC-8 | Security | `JWT_SECRET` strength enforced at config load (rejects known-weak placeholders and secrets < 16 chars). + tests. |
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
| CLN-9 | Cleanup | Desktop test harness added (`vitest` + jsdom): tests for the auth store (incl. BUG-1 expiry regression) and the API client envelope handling. Desktop CI workflow added (typecheck + test). |
| FEAT-1 | Feature | Job **notes** field added end-to-end (schema, service, multipart, contract) and wired through the desktop form (config, hook, normalize/diff, help text). + test. |
| TEST | Infra | `tests/conftest.py` backs the app with `mongomock` (incl. GridFS); suite runs offline. New test/runtime deps pinned in `requirements.txt`. |

---

## 3. ⬜ Remaining Security Hardening

_All P0–P2 security items are complete._ Remaining hardening is lower priority:

| ID | Pri | Issue | Notes |
| --- | --- | --- | --- |
| SEC-10 | P3 | **`register` leaks which emails exist** (409 vs 401 + timing). Rate limiting (SEC-3) blunts enumeration but the distinction remains. | Consider uniform messaging / response timing. |

---

## 4. ⬜ Remaining Cleanup & Tech Debt

| ID | Pri | Item |
| --- | --- | --- |
| CLN-5 | P2 | **Response models mostly unused.** Analytics validates via `JobStatusCounts`, but jobs/alerts/users handlers still return raw dicts. Wire `response_model` (envelope-aware) or drop the dead schemas. Note: validating list items through `Job` would coerce `url`→`HttpUrl` and may alter serialized output, so do it deliberately. |
| CLN-8 | P3 | **Naming:** path param `id` vs document field `jobId` (external ref) is confusing. |
| CLN-11 | P3 | **Address downgraded lint warnings.** `react-hooks/set-state-in-effect` (3) and `immutability` (2) + `react-refresh/only-export-components` (1) are now warnings — refactor the effects/dialog module to satisfy them, then promote back to errors. |

---

## 5. ⬜ Next Functionality

### v1.x
- **FEAT-2 follow-up (P3): Map `error.details` onto job-form fields.** The auth
  screen surfaces server validation; the job form still shows only its own
  client-side validation for server errors.

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

1. **v2 kickoff:** FEAT-4 alert delivery + providers (FEAT-5) — the headline feature.
2. **Tighten contracts:** CLN-5 response models (carefully — see note).
3. **Platform & polish:** FEAT-8 builds, remaining analytics, enumeration hardening,
   and promoting the downgraded lint warnings back to errors (CLN-11).
