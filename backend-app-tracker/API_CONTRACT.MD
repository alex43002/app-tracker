# API v1 — Final Standards Addendum (LOCK-IN)

Base path remains: `/api`
All prior symmetry rules remain authoritative.

---

## 1. Pagination & Filtering Standards

These standards apply to **all list endpoints** (e.g. jobs, alerts).

---

### 1.1 Query Parameters (Uniform)

All list endpoints **must** accept the following optional query parameters:

```
?page=number
?pageSize=number
?sortBy=string
?sortOrder=asc|desc
?filters=<json-string>
```

#### Defaults

* `page`: 1
* `pageSize`: 25
* `sortOrder`: asc

---

### 1.2 Filters Format (Standardized)

Filters are passed as a **JSON-encoded object** to avoid endpoint-specific logic.

Example:

```
GET /api/jobs?filters={"status":"applied","employmentType":"full-time"}
```

Backend behavior:

* AND logic between keys
* Exact match unless field supports range (salary, dates)

---

### 1.3 Paginated Response Shape (LOCKED)

```json
{
  "success": true,
  "data": {
    "items": [ /* entity array */ ],
    "meta": {
      "page": number,
      "pageSize": number,
      "totalItems": number,
      "totalPages": number
    }
  },
  "error": null
}
```

This shape is **identical across all resources**.

---

## 2. Error Handling Standard

### 2.1 Error Envelope (LOCKED)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "string",
    "message": "string"
  }
}
```

No endpoint may return raw errors.

---

### 2.2 Error Code Taxonomy

#### Authentication / Authorization

| Code                       | Meaning                       |
| -------------------------- | ----------------------------- |
| `AUTH_INVALID_CREDENTIALS` | Login failed                  |
| `AUTH_TOKEN_EXPIRED`       | JWT expired                   |
| `AUTH_TOKEN_INVALID`       | Malformed or invalid JWT      |
| `AUTH_UNAUTHORIZED`        | Missing token                 |
| `AUTH_FORBIDDEN`           | Accessing another user’s data |

---

#### Validation

| Code                     | Meaning                 |
| ------------------------ | ----------------------- |
| `VALIDATION_ERROR`       | Input failed validation |
| `MISSING_REQUIRED_FIELD` | Required field missing  |
| `INVALID_FIELD_TYPE`     | Wrong data type         |

---

#### Resource

| Code                           | Meaning                   |
| ------------------------------ | ------------------------- |
| `RESOURCE_NOT_FOUND`           | ID does not exist         |
| `RESOURCE_ALREADY_EXISTS`      | Duplicate unique field    |
| `RESOURCE_OWNERSHIP_VIOLATION` | Cross-user access attempt |

---

#### System

| Code                    | Meaning                |
| ----------------------- | ---------------------- |
| `INTERNAL_SERVER_ERROR` | Unhandled server error |
| `SERVICE_UNAVAILABLE`   | Dependency down        |

---

## 3. JWT Claim Structure (LOCKED)

### 3.1 Token Properties

* Algorithm: HS256 or RS256 (implementation choice)
* Lifespan: **2 hours**
* Passed via:
  `Authorization: Bearer <jwt>`

---

### 3.2 JWT Payload Claims

```json
{
  "sub": "userId",
  "email": "string",
  "iat": number,
  "exp": number,
  "iss": "your-api-name",
  "aud": "desktop-client",
  "scope": "user"
}
```

---

### 3.3 Claim Semantics

| Claim   | Purpose                 |
| ------- | ----------------------- |
| `sub`   | Primary user identifier |
| `email` | Convenience reference   |
| `iat`   | Issued-at timestamp     |
| `exp`   | Expiration timestamp    |
| `iss`   | Token issuer            |
| `aud`   | Intended client         |
| `scope` | Role / access level     |

---

### 3.4 Backend Enforcement Rules

* `sub` **must** be used for user isolation
* No endpoint may accept `userId` from request body for ownership
* All ownership checks derive from JWT only

---

## 4. Refresh Token Rule (FINAL)

* Refresh endpoint returns **same envelope**
* Old JWT becomes invalid after refresh
* Client does **not** reuse expired tokens