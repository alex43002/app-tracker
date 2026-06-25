import os

# Settings are validated at import time, so required env vars must exist before
# `app.config` is imported. These are test-only values.
os.environ.setdefault("MONGODB_URI", "mongodb://localhost:27017/jobtracker_test")
os.environ.setdefault("MONGODB_DB_NAME", "jobtracker_test")
os.environ.setdefault("JWT_SECRET", "test-secret-do-not-use-in-prod")
os.environ.setdefault("JWT_EXPIRY_HOURS", "2")

import mongomock
import mongomock.gridfs
import pytest
from fastapi.testclient import TestClient

# Back the app with an in-memory Mongo (incl. GridFS) so the suite needs no
# external database.
mongomock.gridfs.enable_gridfs_integration()

import app.database as database

_mock_client = mongomock.MongoClient()
_mock_db = _mock_client[os.environ["MONGODB_DB_NAME"]]


@pytest.fixture(scope="session", autouse=True)
def _patch_db():
    database._client = _mock_client
    database._db = _mock_db
    yield


from app.main import app  # noqa: E402  (imported after env + db patch)
from app.common.ratelimit import limiter  # noqa: E402


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # Keep auth rate limits from leaking across tests.
    limiter.reset()
    yield


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="session")
def auth_payload():
    return {
        "email": "test@example.com",
        "password": "password123",
        "phoneNumber": "1234567890",
        "firstName": "Test",
        "lastName": "User",
        "pfp": "base64pfp",
    }


@pytest.fixture(scope="session")
def auth_token(client, auth_payload):
    res = client.post("/api/auth/register", json=auth_payload)
    assert res.status_code == 200
    body = res.json()
    return {
        "jwt": body["data"]["jwt"],
        "userId": body["data"]["user"]["id"],
    }
