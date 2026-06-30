# CareerLog REST API — v1 Contract

> This document reflects the **currently implemented** behaviour of the backend in
> `app/`. It is the authoritative source for the desktop client. When code and this
> document disagree, the code wins — update this file.

**Base URL (local)**

```
http://127.0.0.1:8000
```

**Application endpoints** are mounted under `/api/*`. An unauthenticated
`GET /health` returns `{ "status": "ok" }`.

**Auth** — JWT Bearer token:

```
Authorization: Bearer <JWT>
```

Two HS256 token types are issued (distinguished by a `type` claim):

- **access** — sent as the `Bearer` token on every request. Lifetime
  `JWT_EXPIRY_HOURS` (default **2h**). Carries `sub`, `email`, `type: "access"`,
  issuer `job-tracker-api`, audience `desktop-client`, `scope: "user"`.
- **refresh** — long-lived (default **7d**, `REFRESH_TOKEN_EXPIRY_DAYS`), carries a
  unique `jti`, and is exchanged at `/api/auth/refresh` for a new pair. Refresh
  tokens **rotate** (the presented one is revoked) and can be revoked via
  `/api/auth/logout`. Only an access token is accepted on protected routes.

---

## Global Conventions

### Response Envelope (all JSON endpoints)

```json
{ "success": true,  "data": {}, "error": null }
```

On error:

```json
{ "success": false, "data": null, "error": { "code": "ERROR_CODE", "message": "Human readable message" } }
```

> All errors — including framework/validation errors — are returned as the bare
> envelope above (global exception handlers normalize them). Request-validation
> failures additionally include `error.details: [{ field, message }]`.

### Pagination (list endpoints: jobs, alerts)

Query params: `?page=1&pageSize=25&sortBy=createdAt&sortOrder=asc&filters=<json>`

- `page` ≥ 1 (default `1`)
- `pageSize` 1–100 (default **25**)
- `sortBy` — any document field (default `createdAt`)
- `sortOrder` — `asc` | `desc` (default `asc`)
- `filters` — optional JSON-encoded object merged into the query

Response `data` shape:

```json
{
  "items": [],
  "meta": { "page": 1, "pageSize": 25, "totalItems": 0, "totalPages": 0 }
}
```

`filters` is **whitelisted per resource** and can never override the `userId`
scope; unknown keys, Mongo operators (`$...`), and operator-object values are
rejected with `VALIDATION_ERROR` (400). Allowed fields:

- **jobs:** `status`, `employmentType`, `company`, `location`
- **alerts:** `smsOrEmail`

`sortBy` is likewise restricted to known fields (falls back to `createdAt`).

---

## Authentication

### Register

```
POST /api/auth/register
```

Request:

```json
{
  "email": "test@example.com",
  "password": "plaintext (min 8 chars)",
  "phoneNumber": "1234567890",
  "firstName": "Test",
  "lastName": "User"
}
```

> Profile pictures are **not** part of registration — `pfp` starts `null` and is
> uploaded separately via `PUT /api/users/{id}/pfp` (see Users).

Response (`data`): the new user **plus** an issued session token.

```json
{
  "user": {
    "id": "string",
    "email": "test@example.com",
    "phoneNumber": "1234567890",
    "firstName": "Test",
    "lastName": "User",
    "pfp": null,
    "emailVerified": false,
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  },
  "jwt": "ACCESS_JWT",
  "expiresAt": "ISO-8601",
  "refreshToken": "REFRESH_JWT",
  "refreshExpiresAt": "ISO-8601"
}
```

Errors: `RESOURCE_ALREADY_EXISTS` (409) if the email is taken.

### Login

```
POST /api/auth/login
```

Request:

```json
{ "email": "test@example.com", "password": "plaintext" }
```

Response (`data`): identical shape to Register —
`{ user, jwt, expiresAt, refreshToken, refreshExpiresAt }`.

Errors: `AUTH_INVALID_CREDENTIALS` (401).

### Refresh

```
POST /api/auth/refresh
```

Exchanges a **refresh** token for a new access + refresh pair, **rotating** it (the
presented refresh token is revoked and cannot be reused).

Request:

```json
{ "refreshToken": "current-valid-REFRESH_JWT" }
```

Response (`data`):

```json
{
  "jwt": "new-ACCESS_JWT",
  "expiresAt": "ISO-8601",
  "refreshToken": "new-REFRESH_JWT",
  "refreshExpiresAt": "ISO-8601"
}
```

Errors: `AUTH_TOKEN_INVALID` (401) if the token is invalid/expired, is not a
refresh token, has already been rotated/revoked, or its user no longer exists.
**Replaying an already-rotated refresh token is treated as theft**: the user's
entire refresh-token family is revoked (every session must re-authenticate).

### Logout

```
POST /api/auth/logout
```

Revokes a refresh token so it can no longer be used to refresh. Idempotent and
best-effort (always returns success).

Request:

```json
{ "refreshToken": "REFRESH_JWT" }
```

Response (`data`): `null`.

### Request Password Reset

```
POST /api/auth/password-reset/request
```

Emails a single-use reset token to the address if it belongs to an account.
**Always** returns success and `data: null` — the response never reveals whether
the email is registered (avoids account enumeration). Rate-limited.

Request:

```json
{ "email": "test@example.com" }
```

Response (`data`): `null`.

### Confirm Password Reset

```
POST /api/auth/password-reset/confirm
```

Consumes the single-use token and sets a new password. Setting a new password
**revokes every existing session** for the account (all refresh tokens are
invalidated). Rate-limited.

Request:

```json
{ "token": "RESET_TOKEN", "newPassword": "plaintext (min 8 chars)" }
```

Response (`data`): `null`. Errors: `AUTH_TOKEN_INVALID` (400) if the token is
invalid, already used, or expired.

### Request Email Verification

```
POST /api/auth/verify-email/request
```

Re-sends a verification token. Registration already sends one automatically;
this resends it. Always returns success (no enumeration); already-verified
accounts are skipped silently. Rate-limited.

Request:

```json
{ "email": "test@example.com" }
```

Response (`data`): `null`.

### Confirm Email Verification

```
POST /api/auth/verify-email/confirm
```

Consumes the single-use token and marks the account's email verified
(`emailVerified: true`). Rate-limited.

Request:

```json
{ "token": "VERIFICATION_TOKEN" }
```

Response (`data`): `null`. Errors: `AUTH_TOKEN_INVALID` (400) if the token is
invalid, already used, or expired.

---

## Users

All user routes require auth and enforce **self-ownership** — the `{id}` in the
path must equal the JWT `sub`, otherwise `RESOURCE_OWNERSHIP_VIOLATION` (403).

### Get Current User

```
GET /api/users/me
```

Response (`data`):

```json
{
  "id": "string",
  "email": "string",
  "phoneNumber": "string",
  "firstName": "string",
  "lastName": "string",
  "pfp": "GridFS file id, or null",
  "emailVerified": false,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

`pfp` is a GridFS file id (or `null`); fetch the image bytes from
`GET /api/users/{id}/pfp`. `emailVerified` reflects whether the account has
confirmed its email (see `POST /api/auth/verify-email/*`).

### Get User by Id

```
GET /api/users/{id}
```

Same response shape as `/me`. `RESOURCE_OWNERSHIP_VIOLATION` (403) if `id` is not
the caller; `RESOURCE_NOT_FOUND` (404) if missing.

### Update User

```
PUT /api/users/{id}
```

Request (partial; at least one field required):

```json
{ "phoneNumber": "...", "firstName": "...", "lastName": "..." }
```

Response (`data`): `{ "updatedAt": "ISO-8601" }`. Empty payload →
`VALIDATION_ERROR` (400). (Profile pictures are managed via the `pfp` endpoints
below, not this route.)

### Profile Picture

Stored in GridFS, like résumés; self-ownership enforced.

```
PUT    /api/users/{id}/pfp     # multipart, field `pfp` (image)
GET    /api/users/{id}/pfp     # returns the raw image bytes (inline)
DELETE /api/users/{id}/pfp     # removes the picture
```

- Allowed types: `png`, `jpeg`, `webp`, `gif`; max **2MB** — otherwise
  `VALIDATION_ERROR` (400/413).
- `PUT` response (`data`): `{ "pfp": "GridFS-id", "updatedAt": "ISO-8601" }`
  (replaces and deletes any previous picture).
- `GET` returns `RESOURCE_NOT_FOUND` (404) when no picture is set.

> Note: `email` is **not** updatable via this endpoint.

### Delete User

```
DELETE /api/users/{id}
```

Response (`data`): `null`.

---

## Jobs

### Create Job

```
POST /api/jobs/
```

Accepts **either** `application/json` **or** `multipart/form-data` (when uploading
a résumé file under the `resume` field).

Fields:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `url` | string (URL) | ✅ | Validated as an `HttpUrl` |
| `jobTitle` | string | ✅ | |
| `company` | string | ✅ | |
| `salaryTarget` | number | ✅ | |
| `status` | string | ✅ | e.g. `applied`, `interviewing`, `offer`, `rejected` |
| `location` | string | ✅ | |
| `employmentType` | string | ✅ | e.g. `full-time` |
| `jobId` | string | — | Optional external reference |
| `salaryRange` | string | — | |
| `notes` | string | — | Free-text notes |
| `resume` | file (multipart) / GridFS id (json) | — | Stored in GridFS; ≤5MB; `pdf`, `doc`, `docx`, or `txt` only |

Response (`data`):

```json
{ "id": "string", "createdAt": "ISO-8601", "updatedAt": "ISO-8601" }
```

### List Jobs

```
GET /api/jobs/?page=1&pageSize=25&sortBy=createdAt&sortOrder=asc
```

Response `data` is paginated. Each item is the full job document with `id`
(string) instead of `_id`, including `userId`, all job fields, `resume` (GridFS
file id or `null`), `createdAt`, `updatedAt`.

### Update Job

```
PUT /api/jobs/{id}
```

Partial update. Accepts JSON or multipart (to replace the legacy single résumé —
the previous GridFS file is deleted). Response (`data`): `{ "updatedAt": "ISO-8601" }`.
Empty payload → `VALIDATION_ERROR` (400); unknown/foreign job →
`RESOURCE_NOT_FOUND` (404).

> **Status history (FEAT-13).** Changing a job's `status` appends
> `{ status, at }` to the job's `statusHistory` array (seeded with the initial
> status at create time). A no-op status update adds no entry. Analytics use this
> timeline for exact transition timing.

### Delete Job

```
DELETE /api/jobs/{id}
```

Deletes the job and **all** its GridFS résumés (the legacy single `resume` plus
every `resumes[]` entry). Response (`data`): `null`.

### Job Résumés (FEAT-10)

A job may carry multiple résumés. Each is stored in GridFS (type/size validated,
ownership-stamped) with metadata tracked in the job's `resumes[]` array.

```
GET    /api/jobs/{id}/resumes
POST   /api/jobs/{id}/resumes          # multipart, field name "resume"
DELETE /api/jobs/{id}/resumes/{resumeId}
```

- **GET** → `{ "resumes": [ { id, filename, contentType, size, uploadedAt } ] }`.
  A résumé attached via the legacy single-`resume` create flow is surfaced as a
  synthesized entry, so older jobs still list their attachment.
- **POST** (multipart, `resume` file) → the created entry
  `{ id, filename, contentType, size, uploadedAt }`. Validates type
  (`pdf/doc/docx/txt`) and size (≤5MB) like the create flow.
- **DELETE** removes the résumé from GridFS and the job. Unknown job/résumé →
  `RESOURCE_NOT_FOUND` (404).

---

## Résumés

### Download / Preview Résumé

```
GET /api/resumes/{resume_id}[?disposition=inline]
```

`resume_id` is the **GridFS file id** of any résumé owned by the caller (a job's
legacy `resume` field or a `resumes[]` entry's `id`). Returns the raw file bytes
(not an envelope) with the stored content type. `Content-Disposition` defaults to
`attachment`; pass `disposition=inline` for the in-app preview. Ownership is
enforced via the file's `metadata.userId`.

Errors: `INVALID_RESUME_ID` (400), `RESUME_NOT_FOUND` (404), `FORBIDDEN` (403).

---

## Alerts

Alerts are follow-up reminders. A background scheduler delivers each alert once its
`scheduledAlert` time passes (via the configured notifier — console by default, or
SMTP email when configured) and stamps `lastAlertAt`. Rescheduling an alert to a new
time lets it fire again. Delivery can be turned off with `ALERTS_ENABLED=false`.

### Create Alert

```
POST /api/alerts/
```

Request:

```json
{
  "scheduledAlert": "2026-01-01T10:00:00Z",
  "smsOrEmail": "email",
  "message": "Follow up with recruiter"
}
```

`smsOrEmail` must be `"sms"` or `"email"`. Response (`data`):

```json
{ "id": "string", "createdAt": "ISO-8601", "updatedAt": "ISO-8601" }
```

### List Alerts

```
GET /api/alerts/?page=1&pageSize=25
```

Paginated. Each item:

```json
{
  "id": "string",
  "userId": "string",
  "scheduledAlert": "ISO-8601",
  "smsOrEmail": "email",
  "message": "string",
  "lastAlertAt": null,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

### Update Alert

```
PUT /api/alerts/{id}
```

Partial (`scheduledAlert`, `smsOrEmail`, `message`). Response (`data`):
`{ "updatedAt": "ISO-8601" }`.

### Delete Alert

```
DELETE /api/alerts/{id}
```

Response (`data`): `null`.

---

## Analytics

### Job Status Counts

```
GET /api/analytics/status-counts
```

Response (`data`):

```json
{ "applied": 0, "interviewing": 0, "offer": 0, "rejected": 0, "total": 0 }
```

All analytics endpoints require auth and are scoped to the caller (JWT `sub`).

### Funnel

```
GET /api/analytics/funnel
```

Status counts plus headline conversion rates. Each rate is a `0..1` ratio.

```json
{
  "applied": 4, "interviewing": 2, "offer": 1, "rejected": 3, "total": 10,
  "responseRate": 0.6,
  "interviewRate": 0.3,
  "offerRate": 0.1
}
```

- `responseRate` = jobs past the initial "applied" stage ÷ total.
- `interviewRate` = (interviewing + offer) ÷ total.
- `offerRate` = offer ÷ total. (Rates are `0.0` when `total` is 0.)

### Applications Over Time

```
GET /api/analytics/applications-over-time[?interval=week|month|quarter]
```

Applications grouped by period (by `createdAt`), ascending. `interval` defaults
to `month`; an unknown value falls back to `month`. Period labels are
`YYYY-MM` (month), `YYYY-Www` (ISO week), or `YYYY-Qn` (quarter).

```json
{
  "interval": "month",
  "points": [
    { "period": "2026-05", "count": 1 },
    { "period": "2026-06", "count": 2 }
  ]
}
```

### Time To Offer

```
GET /api/analytics/time-to-offer
```

Average / median **days** from application (`createdAt`) to offer. Uses the job's
`statusHistory` (FEAT-13) to find when the offer landed — exact when history is
present, falling back to `updatedAt` for jobs created before status history
existed. `averageDays` / `medianDays` are `null` when there are no offers.

```json
{ "offers": 2, "averageDays": 15.0, "medianDays": 15.0 }
```

### By Company

```
GET /api/analytics/by-company
```

Per-company status breakdown, busiest companies first.

```json
{
  "companies": [
    { "company": "BigCo", "applied": 1, "interviewing": 1, "offer": 1, "rejected": 0, "total": 3 },
    { "company": "SmallCo", "applied": 0, "interviewing": 0, "offer": 0, "rejected": 1, "total": 1 }
  ]
}
```

### Summary (combined)

```
GET /api/analytics/summary[?interval=week|month|quarter]
```

All headline analytics in one response, computed from a single per-user fetch
(CLN-13). Saves the dashboard four round-trips.

```json
{
  "funnel": { "...": "see Funnel" },
  "applicationsOverTime": { "...": "see Applications Over Time" },
  "timeToOffer": { "...": "see Time To Offer" },
  "byCompany": { "...": "see By Company" }
}
```

---

## Saved Searches (FEAT-11)

Named, reusable job-list queries (filters + sort) scoped to the authenticated
user. `filters` is validated against the same whitelist as the jobs list endpoint
(`status`, `employmentType`, `company`, `location`); `sortBy` must be a sortable
job field and `sortOrder` is `asc`/`desc`. Disallowed fields or Mongo operators →
`VALIDATION_ERROR` (400).

```
POST   /api/saved-searches            # { name, filters?, sortBy?, sortOrder? }
GET    /api/saved-searches            # { items: [ SavedSearch ] }
PUT    /api/saved-searches/{id}       # partial update
DELETE /api/saved-searches/{id}
```

A `SavedSearch` is:

```json
{
  "id": "…",
  "name": "Remote offers",
  "filters": { "status": "offer", "location": "Remote" },
  "sortBy": "company",
  "sortOrder": "desc",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

---

## Matching (FEAT-21)

Résumé ↔ job matching. Extracts skills/keywords (a curated taxonomy plus
classic frequency-based keyword extraction — **no generative AI**) and scores a
résumé against a job description so a seeker can see their fit before applying.
Both endpoints require auth.

### Scrape a Job Posting

```
POST /api/match/scrape          # { "url": "https://…" }
```

Fetches a public posting URL and extracts its terms. The fetch is SSRF-guarded:
only `http(s)`, the host must resolve to public IPs, redirects are re-validated
per hop, and the body is size/time capped. Response (`data`):

```json
{
  "title": "Backend Engineer",
  "textLength": 1234,
  "skills": ["python", "fastapi", "docker"],
  "keywords": ["distributed systems", "payments"]
}
```

Errors: `JOB_FETCH_FAILED` (400, e.g. non-public address / unreachable),
`JOB_FETCH_EMPTY` (422, no readable text at the URL).

### Score a Résumé Against a Job

```
POST /api/match/score
```

Request — provide **one résumé source** (`resumeId` of an uploaded résumé *or*
raw `resumeText`) and **one job source** (`jobUrl` to scrape *or* raw
`jobDescription` text):

```json
{ "resumeId": "…", "jobDescription": "We need Python, Django, AWS…" }
```

Response (`data`) — a 0–100 score plus an explainable breakdown and the gaps
(missing skills first) for gap analysis:

```json
{
  "score": 82,
  "breakdown": {
    "skillCoverage": 0.8,
    "keywordCoverage": 0.5,
    "matchedSkills": ["python", "django"],
    "missingSkills": ["aws"],
    "matchedKeywords": ["payments"],
    "missingKeywords": ["fintech"]
  },
  "gaps": ["aws", "fintech"],
  "resume": { "skills": ["python", "django"], "keywords": ["payments"] },
  "job":    { "skills": ["python", "django", "aws"], "keywords": ["payments", "fintech"] }
}
```

Errors: `VALIDATION_ERROR` (422, missing a résumé/job source),
`RESUME_UNREADABLE` (422, couldn't extract text from the file), plus the résumé
ownership/lookup errors (`RESOURCE_OWNERSHIP_VIOLATION`, `RESUME_NOT_FOUND`,
`INVALID_RESUME_ID`) and the scrape errors above when `jobUrl` is used.

---

## Discovery (FEAT-22)

Aggregated, normalized public job postings collected from supported ATS systems
(Greenhouse, Lever). Postings are **shared** (not per-user) and deduped per
source by `(source, boardToken, sourceId)`. All endpoints require auth. Only
public ATS JSON APIs are used — no HTML scraping, nothing behind a login.

### Supported Sources

```
GET /api/discovery/sources      # { "sources": ["greenhouse", "lever"] }
```

### Ingest a Board

```
POST /api/discovery/ingest
```

Fetches a company's public board and upserts its postings. `boardToken` is the
slug from the company's careers URL (e.g. `acme` in
`boards.greenhouse.io/acme`). Request:

```json
{ "source": "greenhouse", "boardToken": "acme", "companyName": "Acme Inc" }
```

Response (`data`):

```json
{ "source": "greenhouse", "company": "Acme Inc", "fetched": 12, "inserted": 10, "updated": 2 }
```

Errors: `UNSUPPORTED_SOURCE` (400), `DISCOVERY_FETCH_FAILED` (400, unknown board
/ ATS unreachable / bad token).

### Resolve a Board Token from a URL (FEAT-23)

```
POST /api/discovery/resolve
```

Extracts the ATS source + board token from a pasted careers URL so users don't
have to know what a board token is. Recognises Greenhouse
(`boards.greenhouse.io/<token>`, `job-boards.greenhouse.io/<token>`,
`boards-api.greenhouse.io/v1/boards/<token>`) and Lever
(`jobs.lever.co/<token>`, `api.lever.co/v0/postings/<token>`). Request:

```json
{ "url": "https://boards.greenhouse.io/stripe/jobs/123" }
```

Response (`data`): `{ "source": "greenhouse", "boardToken": "stripe" }`.
Errors: `VALIDATION_ERROR` (422) when no board token can be found.

### Company Directory (FEAT-23)

```
GET /api/discovery/companies?q=<substring>&limit=20
```

A curated directory of popular public boards so users can pick a company
instead of guessing a slug. Case-insensitive substring match on the name; an
empty `q` returns the head of the directory. Response (`data`):

```json
{ "companies": [{ "name": "Stripe", "source": "greenhouse", "boardToken": "stripe" }] }
```

### Search Postings

```
GET /api/discovery/jobs?page=1&pageSize=25&sortBy=postedAt&sortOrder=desc&collapse=true
    &q=&company=&location=&employmentType=&source=&salaryMin=
    &experienceLevel=&requiresDegree=&maxAgeDays=&minQuality=
```

Paginated (same envelope as other list endpoints). Filters:

- `q` (title substring), `company`/`location` (substring)
- `employmentType` (exact, canonical
  `full-time|part-time|contract|internship|temporary`), `source` (exact)
- `salaryMin` — postings whose `salaryMax` ≥ value
- `experienceLevel` — `entry|mid|senior|lead` (eligibility)
- `requiresDegree` — `true|false` (eligibility)
- `sponsorshipAvailable` — `true|false` (work-authorization eligibility)
- `clearanceRequired` — `true|false` (eligibility)
- `maxAgeDays` — only postings with `postedAt` within N days (freshness)
- `minQuality` — `qualityScore` ≥ value (0–100; hides low-quality listings)
- `collapse` (default `true`) — merge duplicate postings of the same role across
  boards/sources into one listing; `false` returns raw per-posting rows.
- `applyPreferences` (default `false`) — exclude the caller's hidden companies /
  job types (see Preferences). `preferredOnly` (default `false`) restricts to the
  caller's preferred employers.

`sortBy` ∈ `postedAt|ingestedAt|company|title|salaryMax`. Each item:

```json
{
  "id": "…",
  "source": "greenhouse",
  "sourceId": "111",
  "boardToken": "acme",
  "company": "Acme Inc",
  "title": "Backend Engineer",
  "location": "Remote, US",
  "employmentType": "full-time",
  "url": "https://boards.greenhouse.io/acme/jobs/111",
  "description": "…(≤5000 chars, plain text)…",
  "salaryMin": 120000,
  "salaryMax": 150000,
  "postedAt": "ISO-8601 | null",
  "ingestedAt": "ISO-8601",
  "updatedAt": "ISO-8601",

  "experienceLevel": "senior | null",
  "requiresDegree": true,
  "sponsorshipAvailable": true,
  "clearanceRequired": false,
  "qualityFlags": ["no_salary", "thin_description", "no_location", "underpaid", "spammy_title"],
  "qualityScore": 100,

  "duplicateCount": 2,
  "sources": [
    { "source": "greenhouse", "boardToken": "acme", "url": "https://…" },
    { "source": "lever", "boardToken": "acme", "url": "https://…" }
  ]
}
```

`duplicateCount`/`sources` are present only when `collapse=true` (the default).
`qualityFlags` is the subset of the listed flags that apply.
`sponsorshipAvailable` is `true|false|null` (null = the posting doesn't say).

---

## Preferences (FEAT-22)

Per-user company preferences, applied to discovery when the caller opts in
(`applyPreferences` / `preferredOnly`). All endpoints require auth.

```
GET /api/preferences            # current preferences (defaults to empty lists)
PUT /api/preferences            # partial update — only provided lists are replaced
```

Shape (both request and response `data`):

```json
{
  "preferredCompanies": ["Stripe"],
  "hiddenCompanies": ["BadCo"],
  "hiddenEmploymentTypes": ["contract"]
}
```

List values are trimmed and de-duped case-insensitively on write. A `PUT` with a
subset of fields leaves the omitted lists unchanged.

---

## Job Alerts (FEAT-22)

Saved discovery searches that notify the owner when **new** matching postings are
ingested. `criteria` is a subset of the discovery filter keys (validated against
that allowlist; unknown keys are dropped). The background scheduler (shared with
reminders) notifies via the configured notifier; "new" means ingested since the
alert was last checked. All endpoints require auth.

```
POST   /api/job-alerts            # { name, criteria?, notify? }
GET    /api/job-alerts            # { items: [ JobAlert ] }
PUT    /api/job-alerts/{id}       # partial update (name / criteria / notify)
DELETE /api/job-alerts/{id}
POST   /api/job-alerts/{id}/check # re-run now → { newMatches, total }
```

A `JobAlert`:

```json
{
  "id": "…",
  "name": "Remote senior Python",
  "criteria": { "q": "python", "location": "Remote", "experienceLevel": "senior" },
  "notify": true,
  "lastCheckedAt": "ISO-8601 | null",
  "lastNotifiedAt": "ISO-8601 | null",
  "lastMatchCount": 3,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

`POST /{id}/check` re-runs the search immediately, returns `newMatches` (since
last check) and `total`, advances `lastCheckedAt`, and notifies when `notify` is
set and there are new matches.

---

## Error Codes (v1, as implemented)

| Code | HTTP | Meaning |
| --- | --- | --- |
| `AUTH_REQUIRED` | 401 | No/!malformed Authorization header |
| `AUTH_TOKEN_INVALID` | 401 | Malformed or expired JWT |
| `AUTH_INVALID_CREDENTIALS` | 401 | Bad email/password on login |
| `RESOURCE_ALREADY_EXISTS` | 409 | Email already registered |
| `RESOURCE_OWNERSHIP_VIOLATION` | 403 | Resource not owned by caller (users & résumés) |
| `RESOURCE_NOT_FOUND` | 404 | Resource does not exist |
| `INVALID_RESUME_ID` | 400 | Résumé id is not a valid ObjectId |
| `RESUME_NOT_FOUND` | 404 | No GridFS file for that id |
| `RESUME_UNREADABLE` | 422 | Could not extract text from the résumé file (matching) |
| `JOB_FETCH_FAILED` | 400 | Job-posting URL could not be fetched safely/successfully |
| `JOB_FETCH_EMPTY` | 422 | No readable job text found at the URL |
| `UNSUPPORTED_SOURCE` | 400 | Discovery ingest requested for an unsupported ATS |
| `DISCOVERY_FETCH_FAILED` | 400 | ATS board could not be fetched (unknown board / unreachable / bad token) |
| `VALIDATION_ERROR` | 400 / 413 / 422 | Empty update, bad/forbidden filters, request validation failure, or oversized/invalid résumé |

> Request-validation failures (missing required field, bad `EmailStr`/`HttpUrl`)
> return `VALIDATION_ERROR` (422) as the standard envelope, with
> `error.details: [{ field, message }]`.

---

## Non-Goals (the frontend must not assume these exist)

- Real-time updates, WebSockets, push notifications
- SMS delivery to a real provider (email via SMTP is supported; SMS currently
  logs via the console notifier until a provider like Twilio is added)

See [ROADMAP.md](../ROADMAP.md) for what's planned next.
