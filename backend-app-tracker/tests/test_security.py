import importlib

import pytest


def test_jwt_secret_rejects_weak_value(monkeypatch):
    """SEC-8: a weak/placeholder JWT secret is rejected at config load."""
    monkeypatch.setenv("MONGODB_URI", "mongodb://localhost:27017/x")
    monkeypatch.setenv("JWT_SECRET", "secret")

    import app.config as config

    with pytest.raises(Exception):
        importlib.reload(config)

    # Restore a valid module state for any later imports.
    monkeypatch.setenv("JWT_SECRET", "test-secret-do-not-use-in-prod")
    importlib.reload(config)


def test_jwt_secret_rejects_short_value(monkeypatch):
    """SEC-8: too-short secrets are rejected."""
    monkeypatch.setenv("MONGODB_URI", "mongodb://localhost:27017/x")
    monkeypatch.setenv("JWT_SECRET", "short")

    import app.config as config

    with pytest.raises(Exception):
        importlib.reload(config)

    monkeypatch.setenv("JWT_SECRET", "test-secret-do-not-use-in-prod")
    importlib.reload(config)


def test_deleted_user_token_is_rejected(client, auth_payload):
    """SEC-5: a token for a deleted account no longer authenticates."""
    # Register a throwaway user and grab its session.
    res = client.post(
        "/api/auth/register",
        json={**auth_payload, "email": "sec5@example.com"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    jwt_token = data["jwt"]
    user_id = data["user"]["id"]
    headers = {"Authorization": f"Bearer {jwt_token}"}

    # Token works before deletion.
    assert client.get("/api/users/me", headers=headers).status_code == 200

    # Delete the account (using its own valid token).
    assert client.delete(f"/api/users/{user_id}", headers=headers).status_code == 200

    # The same token must now be rejected.
    after = client.get("/api/users/me", headers=headers)
    assert after.status_code == 401
    assert after.json()["error"]["code"] == "AUTH_TOKEN_INVALID"


def _fresh_session(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    return res.json()["data"]


def test_login_returns_access_and_refresh_tokens(client, auth_payload):
    """SEC-4: register/login issue an access token + a refresh token."""
    data = _fresh_session(client, auth_payload, "sec4-pair@example.com")
    for key in ("jwt", "expiresAt", "refreshToken", "refreshExpiresAt"):
        assert key in data
    assert data["jwt"] != data["refreshToken"]


def test_access_token_cannot_be_used_to_refresh(client, auth_payload):
    """SEC-4: an access token is rejected by /refresh (type enforcement)."""
    data = _fresh_session(client, auth_payload, "sec4-type@example.com")

    res = client.post("/api/auth/refresh", json={"refreshToken": data["jwt"]})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "AUTH_TOKEN_INVALID"


def test_refresh_rotates_and_old_token_is_revoked(client, auth_payload):
    """SEC-4: refreshing rotates the token; the used one can't be replayed."""
    data = _fresh_session(client, auth_payload, "sec4-rotate@example.com")
    old_refresh = data["refreshToken"]

    first = client.post("/api/auth/refresh", json={"refreshToken": old_refresh})
    assert first.status_code == 200
    new_tokens = first.json()["data"]
    assert new_tokens["refreshToken"] != old_refresh

    # New access token works against a protected route.
    me = client.get(
        "/api/users/me",
        headers={"Authorization": f"Bearer {new_tokens['jwt']}"},
    )
    assert me.status_code == 200

    # Replaying the old (now-revoked) refresh token fails.
    replay = client.post("/api/auth/refresh", json={"refreshToken": old_refresh})
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "AUTH_TOKEN_INVALID"


def test_logout_revokes_refresh_token(client, auth_payload):
    """SEC-4: logout revokes the refresh token so it can no longer rotate."""
    data = _fresh_session(client, auth_payload, "sec4-logout@example.com")
    refresh_token = data["refreshToken"]

    out = client.post("/api/auth/logout", json={"refreshToken": refresh_token})
    assert out.status_code == 200

    after = client.post("/api/auth/refresh", json={"refreshToken": refresh_token})
    assert after.status_code == 401


def test_login_is_rate_limited(client):
    """SEC-3: repeated auth attempts are throttled (default 5/minute)."""
    body = {"email": "ratelimit@example.com", "password": "wrong-password"}

    statuses = [client.post("/api/auth/login", json=body).status_code for _ in range(6)]

    # First 5 are processed (401 invalid creds), the 6th is throttled.
    assert statuses[:5] == [401, 401, 401, 401, 401]
    assert statuses[5] == 429
    # The throttled response uses the standard envelope.
    throttled = client.post("/api/auth/login", json=body)
    assert throttled.json()["error"]["code"] == "RATE_LIMITED"
