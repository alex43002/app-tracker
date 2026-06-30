# MongoDB Document Schemas

> Reflects the data actually written by `app/`. Field types describe what the code
> stores today.

## Users Collection

**Collection name:** `users`

```js
{
  _id: ObjectId,

  email: String,            // unique
  passwordHash: String,     // Argon2 hash only — never the plaintext
  phoneNumber: String,

  firstName: String,
  lastName: String,

  pfp: String,              // GridFS file id (or null) — image stored in GridFS

  emailVerified: Boolean,   // set true via /api/auth/verify-email/confirm
  tokenGeneration: Number,  // refresh-token family generation (bumped on reuse)

  createdAt: Date,
  updatedAt: Date
}
```

### Indexes (intended)

```js
{ email: 1 } // unique
```

---

## Jobs Collection

**Collection name:** `jobs`

```js
{
  _id: ObjectId,

  userId: String,           // derived from JWT `sub` — never from the request body

  jobId: String,            // optional external reference (nullable)
  url: String,              // validated as an HttpUrl on input

  jobTitle: String,
  company: String,

  salaryTarget: Number,
  salaryRange: String,      // nullable

  status: String,           // applied | interviewing | offer | rejected

  resume: String,           // legacy single GridFS file id (string) or null

  // FEAT-10: multiple résumés per job. Each entry's bytes live in GridFS.
  resumes: [
    {
      id: String,           // GridFS file id
      filename: String,
      contentType: String,
      size: Number,         // bytes
      uploadedAt: Date
    }
  ],

  // FEAT-13: per-status timeline, appended whenever `status` changes. Seeded
  // with the initial status at create time. Powers exact transition timing.
  statusHistory: [
    { status: String, at: Date }
  ],

  location: String,
  employmentType: String,
  notes: String,           // nullable free-text

  createdAt: Date,
  updatedAt: Date
}
```

Résumé files are stored in **GridFS** (`fs.files` / `fs.chunks`) with
`metadata.userId` for ownership checks; the job document holds only file ids
(legacy `resume` plus the `resumes[]` metadata list).

### Indexes (intended)

```js
{ userId: 1 }
{ status: 1 }
{ employmentType: 1 }
{ createdAt: -1 }
```

---

## Alerts Collection

**Collection name:** `alerts`

```js
{
  _id: ObjectId,

  userId: String,           // derived from JWT `sub`

  scheduledAlert: Date,

  smsOrEmail: String,       // "sms" | "email"
  message: String,

  lastAlertAt: Date,        // nullable; set when the scheduler delivers the alert

  createdAt: Date,
  updatedAt: Date
}
```

### Indexes (intended)

```js
{ userId: 1 }
{ scheduledAlert: 1 }
```

---

## Revoked Tokens Collection

**Collection name:** `revoked_tokens`

Tracks refresh-token `jti`s that have been rotated (used at `/api/auth/refresh`) or
logged out, so they cannot be replayed.

```js
{
  _id: ObjectId,
  jti: String,              // unique; the refresh token's id
  expiresAt: Date           // when the token would have expired anyway
}
```

### Indexes

```js
{ jti: 1 }        // unique
{ expiresAt: 1 }  // TTL (expireAfterSeconds: 0) — purges entries after expiry
```

---

## Auth Tokens Collection

**Collection name:** `auth_tokens`

Single-use tokens for password reset and email verification (FEAT-6). Only the
SHA-256 **hash** of the token is stored, so a collection leak exposes no usable
tokens.

```js
{
  _id: ObjectId,
  tokenHash: String,        // unique; sha256(rawToken)
  userId: String,
  type: String,             // "password_reset" | "email_verify"
  expiresAt: Date,          // TTL purges after expiry
  createdAt: Date,
  usedAt: Date              // null until claimed (single-use)
}
```

### Indexes

```js
{ tokenHash: 1 }  // unique
{ expiresAt: 1 }  // TTL (expireAfterSeconds: 0)
```

---

## Saved Searches Collection

**Collection name:** `saved_searches`

```js
{
  _id: ObjectId,
  userId: String,           // from JWT `sub`

  name: String,
  filters: Object,          // whitelisted job filters (e.g. { status, location })
  sortBy: String,           // a sortable job field
  sortOrder: String,        // "asc" | "desc"

  createdAt: Date,
  updatedAt: Date
}
```

`filters` only ever holds fields whitelisted by the jobs list endpoint — values
are validated on write (no Mongo operators, no foreign fields), so a stored
search is safe to replay against the hardened list query (FEAT-11 / SEC-1).

### Indexes (intended)

```js
{ userId: 1 }
```

---

## Discovered Jobs Collection (FEAT-22)

**Collection name:** `discovered_jobs`

Shared (not per-user) public postings aggregated from supported ATS systems and
normalized into one shape. Deduped per source by `(source, boardToken, sourceId)`.

```js
{
  _id: ObjectId,
  source: String,           // "greenhouse" | "lever"
  boardToken: String,       // company board slug (from the careers URL)
  sourceId: String,         // ATS posting id (unique per board, not globally)
  company: String,          // display name (defaults to boardToken)

  title: String,
  location: String | null,
  employmentType: String | null,  // canonical: full-time|part-time|contract|internship|temporary
  url: String,
  description: String,      // plain text, ≤5000 chars

  salaryMin: Number | null, // best-effort parse from the posting text
  salaryMax: Number | null,

  postedAt: Date | null,    // from the ATS (updated_at / createdAt)
  ingestedAt: Date,         // first time we stored it ($setOnInsert)
  updatedAt: Date           // last upsert
}
```

### Indexes (intended)

```js
{ source: 1, boardToken: 1, sourceId: 1 }  // unique — dedupe key
{ postedAt: -1 }
{ company: 1 }
{ employmentType: 1 }
```

---

## Global Rules (LOCKED)

* `_id` is the MongoDB authority
* API-facing `id = _id.toString()`
* `userId` is **never trusted from the request body** — always from JWT `sub`
* Ownership enforced via JWT `sub`
* All timestamps stored as `Date` (UTC)
* Binary assets (résumés and profile pictures) live in GridFS; the document holds
  only the file id

> The indexes above are created on application startup by
> `app.database.ensure_indexes()` (called from the FastAPI lifespan handler).
