# MongoDB Document Schemas

## Users Collection

**Collection name:** `users`

```js
{
  _id: ObjectId,

  email: String,            // unique
  passwordHash: String,     // hashed password only
  phoneNumber: String,

  firstName: String,
  lastName: String,

  pfp: Buffer,              // stored directly (binary or base64)

  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

```js
{ email: 1 } // unique
```

---

## Jobs Collection

**Collection name:** `jobs`

```js
{
  _id: ObjectId,

  userId: String,           // derived from JWT sub

  jobId: String,            // optional external reference
  url: String,

  jobTitle: String,

  salaryTarget: Number,
  salaryRange: String,

  status: String,

  resume: Buffer,           // stored directly (binary or base64)

  location: String,
  employmentType: String,

  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

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

  userId: String,           // derived from JWT sub

  scheduledAlert: Date,

  smsOrEmail: String,       // "sms" | "email"
  message: String,

  lastAlertAt: Date,        // nullable

  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

```js
{ userId: 1 }
{ scheduledAlert: 1 }
```

---

## Global Rules (LOCKED)

* `_id` is MongoDB authority
* API-facing `id = _id.toString()`
* `userId` is **never trusted from request body**
* Ownership enforced via JWT `sub`
* All timestamps stored as `Date`
* Binary data stored directly in documents