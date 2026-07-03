def test_get_user_happy_path(client, auth_token):
    headers = {"Authorization": f"Bearer {auth_token['jwt']}"}
    res = client.get(f"/api/users/{auth_token['userId']}", headers=headers)

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["id"] == auth_token["userId"]


# ---- Profile settings (FEAT-28) ----


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    body = res.json()["data"]
    return body["jwt"], body["user"]["id"]


def test_update_core_profile_fields(client, auth_payload):
    jwt, uid = _register(client, auth_payload, "profile-edit@example.com")
    headers = {"Authorization": f"Bearer {jwt}"}

    res = client.put(
        f"/api/users/{uid}",
        headers=headers,
        json={"firstName": "Updated", "lastName": "Name", "phoneNumber": "5551234"},
    )
    assert res.status_code == 200

    me = client.get("/api/users/me", headers=headers).json()["data"]
    assert me["firstName"] == "Updated"
    assert me["lastName"] == "Name"
    assert me["phoneNumber"] == "5551234"


def test_update_email_resets_verification(client, auth_payload):
    jwt, uid = _register(client, auth_payload, "profile-email@example.com")
    headers = {"Authorization": f"Bearer {jwt}"}

    res = client.put(
        f"/api/users/{uid}",
        headers=headers,
        json={"email": "Profile-New@Example.com"},
    )
    assert res.status_code == 200
    assert res.json()["data"]["emailVerified"] is False

    me = client.get("/api/users/me", headers=headers).json()["data"]
    # Email is normalized to lowercase.
    assert me["email"] == "profile-new@example.com"
    assert me["emailVerified"] is False


def test_update_email_rejects_duplicate(client, auth_payload):
    _register(client, auth_payload, "taken-target@example.com")
    jwt, uid = _register(client, auth_payload, "dup-source@example.com")
    headers = {"Authorization": f"Bearer {jwt}"}

    res = client.put(
        f"/api/users/{uid}",
        headers=headers,
        json={"email": "taken-target@example.com"},
    )
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "EMAIL_TAKEN"


def test_update_rejects_blank_name(client, auth_payload):
    jwt, uid = _register(client, auth_payload, "blank-name@example.com")
    headers = {"Authorization": f"Bearer {jwt}"}

    res = client.put(
        f"/api/users/{uid}", headers=headers, json={"firstName": "   "}
    )
    assert res.status_code == 422


def test_update_other_user_forbidden(client, auth_payload):
    jwt, _ = _register(client, auth_payload, "edit-self@example.com")
    _, other_id = _register(client, auth_payload, "edit-victim@example.com")
    headers = {"Authorization": f"Bearer {jwt}"}

    res = client.put(
        f"/api/users/{other_id}", headers=headers, json={"firstName": "Hacker"}
    )
    assert res.status_code == 403
