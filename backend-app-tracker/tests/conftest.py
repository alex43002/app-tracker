import os
import pytest
from fastapi.testclient import TestClient

from app.main import app


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
        "pfp": "base64pfp"
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
