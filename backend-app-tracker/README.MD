# Job Tracking Backend API

This repository contains the backend REST API for the Job Tracking application.
It is built using Python, FastAPI, MongoDB, and JWT authentication.

---

## Prerequisites

- Python 3.11+
- pip
- MongoDB (local or Atlas)
- Git

---

## Setup Instructions

### 1. Clone Repository
```bash
git clone <repo-url>
cd backend
````

---

### 2. Create Virtual Environment

```bash
python -m venv .venv
source .venv/bin/activate   # macOS/Linux
.venv\Scripts\activate      # Windows
```

---

### 3. Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

### 4. Environment Variables

Create a `.env` file:

```env
MONGODB_URI=mongodb://localhost:27017/jobtracker
JWT_SECRET=your-secret-key
JWT_EXPIRY_HOURS=2
```

---

### 5. Run the Application

```bash
uvicorn app.main:app --reload
```

API will be available at:

```
http://localhost:8000
```

---

### 6. Run Tests

```bash
pytest
```

---

## Project Goals

* Strict adherence to API v1 contract
* Symmetric request/response schemas
* JWT-based authentication
* User-isolated data access
* MongoDB as source of truth


---

## Project Structure (Locked)
```
backend/
│
├── app/
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── auth/
│   │   ├── routes.py
│   │   ├── service.py
│   │   └── schemas.py
│   ├── users/
│   │   ├── routes.py
│   │   ├── service.py
│   │   └── schemas.py
│   ├── jobs/
│   │   ├── routes.py
│   │   ├── service.py
│   │   └── schemas.py
│   ├── alerts/
│   │   ├── routes.py
│   │   ├── service.py
│   │   └── schemas.py
│   ├── common/
│   │   ├── auth.py
│   │   ├── responses.py
│   │   └── errors.py
│
├── tests/
│   ├── test_auth.py
│   ├── test_users.py
│   ├── test_jobs.py
│   └── test_alerts.py
│
├── requirements.txt
└── .github/
    └── workflows/
        └── ci.yml
```