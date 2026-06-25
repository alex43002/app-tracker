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
  "lastName": "User",
  "pfp": "base64-string"
}
```

Response (`data`): the new user **plus** an issued session token.

```json
{
  "user": {
    "id": "string",
    "email": "test@example.com",
    "phoneNumber": "1234567890",
    "firstName": "Test",
    "lastName": "User",
    "pfp": "base64-string",
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
  "pfp": "string",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

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
{ "phoneNumber": "...", "firstName": "...", "lastName": "...", "pfp": "..." }
```

Response (`data`): `{ "updatedAt": "ISO-8601" }`. Empty payload →
`VALIDATION_ERROR` (400).

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

Partial update. Accepts JSON or multipart (to replace the résumé — the previous
GridFS file is deleted). Response (`data`): `{ "updatedAt": "ISO-8601" }`.
Empty payload → `VALIDATION_ERROR` (400); unknown/foreign job →
`RESOURCE_NOT_FOUND` (404).

### Delete Job

```
DELETE /api/jobs/{id}
```

Deletes the job and its GridFS résumé (if any). Response (`data`): `null`.

---

## Résumés

### Download Résumé

```
GET /api/resumes/{resume_id}
```

`resume_id` is the **GridFS file id** stored on a job's `resume` field. Returns the
raw file bytes (not an envelope) with `Content-Disposition: attachment` and the
stored content type. Ownership is enforced via the file's `metadata.userId`.

Errors: `INVALID_RESUME_ID` (400), `RESUME_NOT_FOUND` (404), `FORBIDDEN` (403).

---

## Alerts

Alerts are **configuration records only** in v1 — stored but never delivered.

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
| `VALIDATION_ERROR` | 400 / 413 / 422 | Empty update, bad/forbidden filters, request validation failure, or oversized/invalid résumé |

> Request-validation failures (missing required field, bad `EmailStr`/`HttpUrl`)
> return `VALIDATION_ERROR` (422) as the standard envelope, with
> `error.details: [{ field, message }]`.

---

## v1 Non-Goals (the frontend must not assume these exist)

- Alerts actually send email/SMS
- Background jobs / schedulers
- Real-time updates, WebSockets, push notifications

These are **v2** features — see [ROADMAP.md](../ROADMAP.md).
