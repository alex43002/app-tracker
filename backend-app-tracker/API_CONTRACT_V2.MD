# CareerLog REST API — v1 Contract

**Base URL (local)**

```
http://127.0.0.1:8000
```

**All application endpoints**

```
/api/*
```

**Auth**

* JWT Bearer token
* Header:

```
Authorization: Bearer <JWT>
```

---

## Global Conventions

### Response Envelope (ALL endpoints)

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

On error:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

---

### Pagination (List endpoints)

Query params:

```
?page=1&pageSize=10
```

Response shape:

```json
{
  "items": [],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

---

### Filtering (optional)

```
?filters={"field":"value"}
```

JSON-encoded string.

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
  "password": "plaintext",
  "fullName": "Test User",
  "pfp": "base64-string"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "userId": "string"
  },
  "error": null
}
```

---

### Login

```
POST /api/auth/login
```

Request:

```json
{
  "email": "test@example.com",
  "password": "plaintext"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "accessToken": "JWT",
    "tokenType": "bearer",
    "expiresIn": 7200
  },
  "error": null
}
```

---

## Users

### Get Current User

```
GET /api/users/me
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "string",
    "email": "string",
    "fullName": "string",
    "pfp": "string",
    "createdAt": "ISO-8601"
  },
  "error": null
}
```

---

### Update User

```
PUT /api/users/me
```

Request (partial allowed):

```json
{
  "fullName": "New Name",
  "pfp": "new-base64"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "updatedAt": "ISO-8601"
  },
  "error": null
}
```

---

### Delete User

```
DELETE /api/users/me
```

Response:

```json
{
  "success": true,
  "data": null,
  "error": null
}
```

---

## Jobs

### Create Job

```
POST /api/jobs/
```

Request:

```json
{
  "company": "Google",
  "title": "Software Engineer",
  "location": "NYC",
  "status": "applied",
  "notes": "Applied via referral"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "string",
    "createdAt": "ISO-8601"
  },
  "error": null
}
```

---

### List Jobs

```
GET /api/jobs/?page=1&pageSize=10
```

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "string",
        "company": "string",
        "title": "string",
        "status": "string",
        "createdAt": "ISO-8601"
      }
    ],
    "meta": {}
  },
  "error": null
}
```

---

### Update Job

```
PUT /api/jobs/{jobId}
```

Request (partial allowed):

```json
{
  "status": "interviewing",
  "notes": "Recruiter call scheduled"
}
```

---

### Delete Job

```
DELETE /api/jobs/{jobId}
```

---

## Alerts

Alerts are **customizable configuration records**, not executed notifications (v1).

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

Response:

```json
{
  "success": true,
  "data": {
    "id": "string",
    "createdAt": "ISO-8601"
  },
  "error": null
}
```

---

### List Alerts

```
GET /api/alerts/?page=1&pageSize=10
```

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "string",
        "scheduledAlert": "ISO-8601",
        "smsOrEmail": "email",
        "message": "string",
        "lastAlertAt": null
      }
    ],
    "meta": {}
  },
  "error": null
}
```

---

### Update Alert

```
PUT /api/alerts/{alertId}
```

Request:

```json
{
  "message": "Second follow-up",
  "smsOrEmail": "sms"
}
```

---

### Delete Alert

```
DELETE /api/alerts/{alertId}
```

---

## Error Codes (v1)

| Code             | Meaning                    |
| ---------------- | -------------------------- |
| AUTH_REQUIRED    | Missing or invalid JWT     |
| FORBIDDEN        | Resource not owned by user |
| NOT_FOUND        | Resource does not exist    |
| VALIDATION_ERROR | Invalid input              |
| INTERNAL_ERROR   | Unexpected server error    |

---

## Explicit v1 Non-Goals (Important for Frontend)

The frontend **must not assume**:

* Alerts actually send emails/SMS
* Background jobs exist
* Real-time updates
* WebSockets
* Push notifications

These are **v2 features**.

---

## Frontend Assumptions (Safe)

The frontend **can assume**:

* Stable response envelopes
* Partial updates allowed
* Pagination everywhere
* Ownership enforced server-side
* JWT stored client-side
