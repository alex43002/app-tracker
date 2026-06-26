# CareerLog — Product Roadmap

_Last updated: 2026-06-26_

This roadmap is grounded in an audit of the backend (`backend-app-tracker/`) and
desktop client (`careerlog-desktop/`). It captures **what the product does today**,
then the prioritized work ahead. Items are tagged by area and rough priority
(**P0** critical → **P3** nice-to-have) and status (✅ done · 🟡 partial · ⬜ open).

> **Status note:** Remediation passes through 2026-06-26 closed **all P0–P2**
> items, including the full access/refresh **token-rotation** flow (SEC-4), the v2
> alert-delivery headline, **multi-instance scheduler safety (FEAT-12)**, the
> **Twilio SMS provider (FEAT-5 follow-up)**, and response-model cleanup (CLN-5).
> A final P3 sweep on 2026-06-26 closed **every remaining roadmap item** —
> enumeration-timing hardening (SEC-10), notifier retry/dead-letter (CLN-12),
> status-history timing + interval (FEAT-13), a combined analytics summary
> (CLN-13), **multiple résumés per job (FEAT-10)**, **saved searches (FEAT-11)**,
> job-form server-error mapping (FEAT-2 follow-up), **optional offline caching
> (FEAT-9)**, the id/jobId naming note (CLN-8), and promoting the downgraded
> desktop lint rules back to errors (CLN-11).
> The backend has a `mongomock`-backed harness (runs with **no external Mongo**)
> gated by `ruff`; the desktop client has a `vitest` harness and its own CI.
> Current state: **backend 73 tests + ruff clean; desktop 48 tests + typecheck +
> eslint clean (0 warnings).** Desktop UI for FEAT-6/FEAT-7 has shipped and
> **cross-platform builds (FEAT-8)** are wired (config + release workflow).
> **No open roadmap items remain** beyond the optional release-prep checklist in §6.

---

## 1. What CareerLog Does Today (v1, shipped)

- **Auth** — register / login / refresh issuing 2-hour HS256 JWTs; Argon2 password
  hashing; per-user data isolation via JWT `sub`.
- **Jobs** — full CRUD with JSON or multipart; résumé upload/replace/download via
  GridFS (now type/size validated); free-text **notes**; pagination, sorting, and
  whitelisted filters on list.
- **Alerts** — CRUD for follow-up reminders, **delivered by a background scheduler**
  via a pluggable notifier (console default, SMTP email when configured).
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
| FEAT-4 / FEAT-5 | Feature | **Alert delivery (v2 headline).** A background scheduler (`app/alerts/runner.py`, started from the lifespan) scans for due alerts and delivers them via a **pluggable notifier** (`app/notifications/notifier.py`): `ConsoleNotifier` default, `SmtpEmailNotifier` when SMTP is configured. Core `process_due_alerts` is idempotent per schedule, supports rescheduling, stamps `lastAlertAt`, and is unit-tested directly. Configurable via `ALERTS_ENABLED` / `ALERTS_POLL_SECONDS` / `SMTP_*`. + tests. |
| TEST | Infra | `tests/conftest.py` backs the app with `mongomock` (incl. GridFS); suite runs offline. New test/runtime deps pinned in `requirements.txt`. |

---

## 2b. ✅ Completed (2026-06-26)

| ID | Area | What changed |
| --- | --- | --- |
| DX | Cleanup | **Fail fast on bad config.** Backend `load_settings()` renders a pydantic `ValidationError` as a friendly checklist (missing/invalid env vars + hints) and exits(1) instead of dumping a traceback. Desktop throws a clear error when `VITE_API_BASE_URL` is unset (was silently hitting `undefined/api/...`); added `.env.example` + gitignored local `.env`. + tests updated. |
| FEAT-12 | Feature | **Multi-instance scheduler safety.** `process_due_alerts` now claims each due alert with a single `findAndModify` (stamps `lastAlertAt` only if still due/unclaimed) *before* delivery, so with multiple scheduler instances exactly one worker delivers a given schedule. Failed delivery releases the claim for retry. + concurrency/retry tests. |
| FEAT-5 (SMS) | Feature | **Twilio SMS notifier.** `TwilioSmsNotifier` delivers `sms` alerts via the Twilio Messages REST API (stdlib HTTP, injectable transport for tests). New `RoutingNotifier` dispatches each channel to its own provider so email (SMTP) and SMS (Twilio) configure independently; unconfigured channels fall back to console. `build_notifier` wires both. Config: `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM`. + tests. |
| CLN-5 | Cleanup | **Response schemas no longer dead.** `CreateJobResponse` / `CreateAlertResponse` / `UpdateUserResponse` are now validated at the route (matching the analytics `Schema(**result).model_dump()` pattern); the `Alert` entity schema backs `_serialize_alert` (like `User`). Dropped the unused `Job` entity schema deliberately — round-tripping its `url` through `HttpUrl` would normalize the wire format clients depend on. |
| FEAT-7 | Feature | **Richer analytics.** Four new auth-scoped endpoints alongside `status-counts`: `funnel` (counts + response/interview/offer conversion rates), `applications-over-time` (monthly buckets by `createdAt`), `time-to-offer` (avg/median days application→offer, using offer `updatedAt` as a proxy), and `by-company` (per-company status breakdown). Date-sensitive metrics compute in Python from a per-user fetch (mongomock-safe); all responses validated through pydantic models. Desktop: matching types + `fetchFunnel`/`fetchApplicationsOverTime`/`fetchTimeToOffer`/`fetchCompanyFunnels`. Backend (7) + desktop (4) tests; contract updated. |
| FEAT-8 | Platform | **Cross-platform builds.** electron-builder now targets Windows (`nsis`), macOS (`dmg` + `zip` for auto-update, hardened runtime + entitlements + notarize-via-env), and Linux (`AppImage` + `deb`); output moved to `release-artifacts/`. New tag-driven `Release Desktop` GitHub Actions workflow builds on all three OS runners and publishes to GitHub Releases, with per-OS signing/notarization wired to secrets (unsigned-but-successful when absent). README "Building & Releasing" + `assets/` icon/entitlements docs added. |
| FEAT-7-UI / FEAT-14 | Feature | **Desktop analytics widgets + email-verify banner.** `AnalyticsInsights` dashboard section renders conversion rates, applications-over-time chart, time-to-offer KPIs, and a per-company table (loading/empty/error states); `EmailVerificationBanner` prompts unverified users. + RTL component tests. |
| FEAT-6-UI | Feature | **Desktop reset/verify screens.** `/reset-password` and `/verify-email` pages over the FEAT-6 client functions, "Forgot password?" link, enumeration-safe messaging; added React Testing Library + component tests. |
| FEAT-6 | Feature | **Password reset & email verification.** Four new auth endpoints (`password-reset/request`+`confirm`, `verify-email/request`+`confirm`) backed by single-use, hashed, TTL'd tokens (`auth_tokens` collection) consumed atomically. Reset revokes all sessions (generation bump); request endpoints never reveal whether an email exists (enumeration-safe) and are rate-limited. Registration auto-sends a verification token; users now carry `emailVerified` (exposed on auth + user responses). Delivery reuses the `Notifier` (injectable `get_notifier`). Desktop: `User.emailVerified` + four API client functions. Backend (9) + desktop (4) tests; contract + Mongo schema docs updated. |

---

## 2c. ✅ Completed (2026-06-26, final P3 sweep)

| ID | Area | What changed |
| --- | --- | --- |
| SEC-10 | Security | **Enumeration-timing hardening.** `register` (taken email) and `login` (missing account) now spend the same Argon2 cost as the success path (`equalize_password_timing`), so neither leaks which emails exist via response latency; login's missing-account and wrong-password responses are byte-identical. The explicit register 409 is kept as a deliberate UX tradeoff. + tests. |
| CLN-12 | Cleanup | **Notifier delivery hardening.** `RetryingNotifier` wraps the real SMTP/Twilio providers with bounded retries + exponential backoff; a final failure is logged as a **dead letter** rather than dropped, and request-time delivery (password reset / verification) never turns a provider outage into a 500. Configurable via `NOTIFIER_MAX_ATTEMPTS` / `NOTIFIER_RETRY_BACKOFF_SECONDS`. + tests. |
| FEAT-13 | Feature | **Accurate status-transition timing.** Jobs carry a `statusHistory` timeline (seeded at create, appended on each status change). `time-to-offer` now measures from it (exact, falling back to `updatedAt` for legacy jobs); `applications-over-time` accepts an `interval` of `week`/`month`/`quarter`. + tests, schema + contract docs. |
| CLN-13 | Cleanup | **Analytics read efficiency.** New `GET /api/analytics/summary` returns funnel + over-time + time-to-offer + by-company from a **single** per-user fetch (the per-endpoint routes still exist). Desktop `fetchAnalyticsSummary`. + tests. |
| FEAT-10 | Feature | **Multiple résumés per job + in-app preview.** Each job has a `resumes[]` list; new `GET/POST/DELETE /api/jobs/{id}/resumes` manage them (type/size validated, ownership-enforced, GridFS-backed), and `/api/resumes/{id}?disposition=inline` supports preview. The legacy single `resume` is surfaced as a synthesized entry. Desktop: API client + a `JobResumeManager` in the job form (list / upload / preview / delete). + backend (5) & desktop (3) tests, docs. |
| FEAT-11 | Feature | **Saved searches / advanced filtering.** New `saved_searches` CRUD (`/api/saved-searches`) storing named filter+sort views, validated against the same hardened whitelist as the jobs list (SEC-1). Desktop: API client + a `SavedSearchesBar` on the Jobs page (save current view, apply, delete). Also **fixed a latent bug**: the toolbar's free-text search sent `$or`/`$regex` filters the hardened backend rejects (400) — search is now applied client-side; only whitelisted fields hit the server. + backend (5) & desktop (4) tests, docs. |
| FEAT-2 (follow-up) | Feature | **Job-form server-error mapping.** A failed save now maps the backend's `error.details` onto the matching job-form fields (was: only client-side validation), falling back to a toast for non-field errors. `useJobForm` gained `setServerErrors`. + test. |
| FEAT-9 | Feature | **Optional offline caching.** A small read-through localStorage cache (`withOfflineCache`): successful reads are cached and, when a later fetch fails (offline), the last-known value is shown with a "showing cached data" banner. Wired into the jobs list; cleared on logout so data can't leak across accounts. + tests. |
| CLN-8 | Cleanup | **id/jobId naming.** Documented the distinction in code (`Job.jobId` is the user-supplied external reference; `id` is the server-assigned record id) so the path-param/field overlap is no longer confusing. |
| CLN-11 | Cleanup | **Downgraded lint warnings promoted back to errors.** Fixed all 8: extracted the confirm-dialog imperative API into its own module (only-export-components) and `useCallback`-ed its handlers (immutability + exhaustive-deps); removed the job-form prefill effect in favor of key-remount + lazy init (set-state-in-effect); deferred the modal animation's state updates into rAF; made the jobs fetch effect cancellation-safe; memoized the toolbar `onChange`. `react-hooks/set-state-in-effect`, `react-hooks/immutability`, and `react-refresh/only-export-components` are back to **error**. |

---

## 3. ✅ Remaining Security Hardening — none open

_All security items, including the final P3, are complete._

| ID | Pri | Status |
| --- | --- | --- |
| SEC-10 | P3 | ✅ Done — enumeration-timing hardening (see §2c). |

---

## 4. ✅ Remaining Cleanup & Tech Debt — none open

| ID | Pri | Status |
| --- | --- | --- |
| CLN-8 | P3 | ✅ Done — id/jobId naming documented (see §2c). |
| CLN-11 | P3 | ✅ Done — all 8 warnings fixed; rules back to errors (see §2c). |

---

## 5. ✅ Next Functionality — all delivered

### v1.x
- ✅ **FEAT-2 follow-up (P3): Map `error.details` onto job-form fields.** Done —
  the job form now surfaces backend field-level validation on save (see §2c).

### v2
- ✅ **FEAT-5 follow-up (P2): SMS provider.** Done — `TwilioSmsNotifier` behind the
  `Notifier` interface, routed per-channel (see §2b).
- ✅ **FEAT-12 (P2): Scheduler robustness for multi-instance.** Done — per-alert
  atomic `findAndModify` claim before delivery (see §2b). A shared scheduler
  (APScheduler jobstore) remains optional if the poll loop itself needs deduping.
- ✅ **FEAT-6 (P2): Password reset & email verification** flows — done (see §2b).
  Backend + desktop API client shipped; dedicated desktop UI screens (reset/verify
  forms) remain as a thin follow-up on top of the new client functions.
- ✅ **FEAT-7 (P2): Richer analytics** — done (see §2b): funnel + conversion rates,
  applications-over-time, time-to-offer, per-company funnels (backend + desktop
  client). Dashboard widgets to surface these in the UI remain a follow-up.

### Product / platform
- ✅ **FEAT-8 (P2): Cross-platform builds** — done (see §2b): Windows/macOS/Linux
  electron-builder targets, signing/notarization scaffolding, and a tag-driven
  GitHub Actions release workflow. _Prereq before a branded release: add a
  1024×1024 `assets/icon.png` and configure the signing secrets._
- ✅ **FEAT-9 (P3): Optional offline caching.** Done — read-through localStorage
  cache with a stale/offline banner (see §2c).
- ✅ **FEAT-10 (P3): Multiple résumés per job** + in-app preview. Done (see §2c).
- ✅ **FEAT-11 (P3): Saved searches / advanced filtering UI.** Done — built on the
  hardened filter whitelist; also fixed the latent `$regex` search bug (see §2c).

### Follow-ups from recent work (captured 2026-06-26)

_Loose ends from the FEAT-5/6/7/12 deliveries — all now shipped: the desktop-UI
follow-ups (FEAT-6-UI, FEAT-7-UI, FEAT-14) and the backend/data threads (FEAT-13,
CLN-12, CLN-13)._

- ✅ **FEAT-6-UI (P2): Desktop reset/verify screens.** Done — `/reset-password`
  (request + confirm phases) and `/verify-email` (confirm + resend) pages on top
  of the shipped client functions, a "Forgot password?" link on login, and a
  neutral enumeration-safe message on request. Added React Testing Library + a
  vitest setup file with component tests for both pages.
- ✅ **FEAT-7-UI (P2): Desktop analytics dashboard widgets.** Done — an
  `AnalyticsInsights` dashboard section fetches all four endpoints and renders
  conversion-rate cards, an applications-over-time bar chart, time-to-offer KPIs,
  and a per-company breakdown (loading / empty / error states + tests).
- ✅ **FEAT-13 (P3): Accurate status-transition timing.** Done — jobs carry a
  `statusHistory` timeline; `time-to-offer` measures from it and
  `applications-over-time` takes a week/month/quarter interval (see §2c).
- ✅ **FEAT-14 (P3): Consume `emailVerified` in the desktop.** Done — the
  dashboard shows an `EmailVerificationBanner` (with a link to `/verify-email`)
  when the current user isn't verified. Gating sensitive actions on verification
  remains optional/future.
- ✅ **CLN-12 (P3): Notifier delivery hardening.** Done — `RetryingNotifier`
  (retry + backoff + dead-letter) around the real providers (see §2c).
- ✅ **CLN-13 (P3): Analytics read efficiency.** Done — combined
  `/api/analytics/summary` from a single per-user fetch (see §2c).

---

## 6. Suggested Sequencing (remaining)

All functional roadmap items are complete. The only remaining work is
**release prep**, which is an ops task rather than a code item:

1. Add a 1024×1024 `assets/icon.png` and configure the signing/notarization
   secrets, then cut the first cross-platform tagged release (FEAT-8).
2. Optional future scaling, only if data volumes grow: move the per-user
   analytics `find` to server-side aggregation, and add an APScheduler jobstore
   if the alert poll loop itself needs deduping across instances.
