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

  resume: String,           // GridFS file id (string) or null — NOT inline binary

  location: String,
  employmentType: String,
  notes: String,           // nullable free-text

  createdAt: Date,
  updatedAt: Date
}
```

Résumé files are stored in **GridFS** (`fs.files` / `fs.chunks`) with
`metadata.userId` for ownership checks; the job document holds only the file id.

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
