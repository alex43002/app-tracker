"""Password reset & email verification flows (FEAT-6)."""

import pytest

from app.notifications import notifier as notifier_module


class CollectingNotifier:
    def __init__(self):
        self.sent = []

    def send(self, channel, recipient, message):
        self.sent.append((channel, recipient, message))

    def token_for(self, recipient):
        """The token embedded in the latest message to ``recipient``."""
        for channel, to, message in reversed(self.sent):
            if to == recipient:
                return message.split()[-1]
        raise AssertionError(f"no message sent to {recipient}")


@pytest.fixture
def notifier():
    """Capture request-time notifications and restore the default afterwards."""
    collecting = CollectingNotifier()
    notifier_module.set_notifier(collecting)
    yield collecting
    notifier_module.set_notifier(None)


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    return res.json()["data"]


def _login(client, email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password})


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------

def test_password_reset_flow(client, auth_payload, notifier):
    email = "reset-flow@example.com"
    _register(client, auth_payload, email)

    req = client.post("/api/auth/password-reset/request", json={"email": email})
    assert req.status_code == 200
    token = notifier.token_for(email)

    confirm = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": token, "newPassword": "brand-new-pass"},
    )
    assert confirm.status_code == 200

    # New password works; the old one no longer does.
    assert _login(client, email, "brand-new-pass").status_code == 200
    assert _login(client, email, auth_payload["password"]).status_code == 401


def test_password_reset_request_unknown_email_is_silent(client, notifier):
    res = client.post(
        "/api/auth/password-reset/request", json={"email": "nobody@example.com"}
    )
    assert res.status_code == 200
    assert res.json()["success"] is True
    assert notifier.sent == []  # nothing leaked, nothing sent


def test_password_reset_rejects_invalid_token(client):
    res = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": "not-a-real-token", "newPassword": "whatever123"},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "AUTH_TOKEN_INVALID"


def test_password_reset_token_is_single_use(client, auth_payload, notifier):
    email = "reset-once@example.com"
    _register(client, auth_payload, email)
    client.post("/api/auth/password-reset/request", json={"email": email})
    token = notifier.token_for(email)

    first = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": token, "newPassword": "first-new-pass"},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/auth/password-reset/confirm",
        json={"token": token, "newPassword": "second-new-pass"},
    )
    assert second.status_code == 400


def test_password_reset_revokes_existing_sessions(client, auth_payload, notifier):
    email = "reset-revoke@example.com"
    session = _register(client, auth_payload, email)
    old_refresh = session["refreshToken"]

    client.post("/api/auth/password-reset/request", json={"email": email})
    token = notifier.token_for(email)
    client.post(
        "/api/auth/password-reset/confirm",
        json={"token": token, "newPassword": "rotated-pass-123"},
    )

    # The pre-reset refresh token belongs to a now-superseded generation.
    refreshed = client.post("/api/auth/refresh", json={"refreshToken": old_refresh})
    assert refreshed.status_code == 401


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------

def test_email_verification_flow(client, auth_payload, notifier):
    email = "verify-flow@example.com"
    session = _register(client, auth_payload, email)
    assert session["user"]["emailVerified"] is False

    # Registration sent a verification token.
    token = notifier.token_for(email)
    confirm = client.post("/api/auth/verify-email/confirm", json={"token": token})
    assert confirm.status_code == 200

    relogin = _login(client, email, auth_payload["password"])
    assert relogin.json()["data"]["user"]["emailVerified"] is True


def test_verify_email_rejects_invalid_token(client):
    res = client.post("/api/auth/verify-email/confirm", json={"token": "bogus"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "AUTH_TOKEN_INVALID"


def test_verify_email_request_resends_for_unverified(client, auth_payload, notifier):
    email = "verify-resend@example.com"
    _register(client, auth_payload, email)
    notifier.sent.clear()

    res = client.post("/api/auth/verify-email/request", json={"email": email})
    assert res.status_code == 200
    token = notifier.token_for(email)

    assert client.post(
        "/api/auth/verify-email/confirm", json={"token": token}
    ).status_code == 200


def test_verify_email_request_skips_verified_and_unknown(client, auth_payload, notifier):
    email = "verify-skip@example.com"
    _register(client, auth_payload, email)
    token = notifier.token_for(email)
    client.post("/api/auth/verify-email/confirm", json={"token": token})
    notifier.sent.clear()

    # Already verified -> nothing sent; unknown email -> nothing sent.
    assert client.post(
        "/api/auth/verify-email/request", json={"email": email}
    ).status_code == 200
    assert client.post(
        "/api/auth/verify-email/request", json={"email": "ghost@example.com"}
    ).status_code == 200
    assert notifier.sent == []
