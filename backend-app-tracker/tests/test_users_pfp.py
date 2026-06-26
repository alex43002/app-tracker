PNG_BYTES = b"\x89PNG\r\n\x1a\n fake-image-data"


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    data = res.json()["data"]
    return data["jwt"], data["user"]["id"]


def test_register_no_longer_requires_pfp(client, auth_payload):
    """SEC-6: registration succeeds without a pfp; pfp starts null."""
    jwt, user_id = _register(client, auth_payload, "pfp-none@example.com")
    me = client.get(
        "/api/users/me", headers={"Authorization": f"Bearer {jwt}"}
    ).json()["data"]
    assert me["pfp"] is None


def test_upload_and_download_profile_picture(client, auth_payload):
    """FEAT-3: upload a profile picture to GridFS, then download it."""
    jwt, user_id = _register(client, auth_payload, "pfp-upload@example.com")
    headers = {"Authorization": f"Bearer {jwt}"}

    up = client.put(
        f"/api/users/{user_id}/pfp",
        headers=headers,
        files={"pfp": ("avatar.png", PNG_BYTES, "image/png")},
    )
    assert up.status_code == 200
    pfp_id = up.json()["data"]["pfp"]
    assert pfp_id

    # /me now reports the GridFS id.
    me = client.get("/api/users/me", headers=headers).json()["data"]
    assert me["pfp"] == pfp_id

    # The image downloads with the right content type.
    dl = client.get(f"/api/users/{user_id}/pfp", headers=headers)
    assert dl.status_code == 200
    assert dl.headers["content-type"] == "image/png"
    assert dl.content == PNG_BYTES


def test_upload_rejects_non_image(client, auth_payload):
    """FEAT-3: a non-image upload is rejected."""
    jwt, user_id = _register(client, auth_payload, "pfp-bad@example.com")
    res = client.put(
        f"/api/users/{user_id}/pfp",
        headers={"Authorization": f"Bearer {jwt}"},
        files={"pfp": ("x.exe", b"MZ", "application/x-msdownload")},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_get_pfp_404_when_unset(client, auth_payload):
    jwt, user_id = _register(client, auth_payload, "pfp-missing@example.com")
    res = client.get(
        f"/api/users/{user_id}/pfp", headers={"Authorization": f"Bearer {jwt}"}
    )
    assert res.status_code == 404


def test_delete_profile_picture(client, auth_payload):
    jwt, user_id = _register(client, auth_payload, "pfp-del@example.com")
    headers = {"Authorization": f"Bearer {jwt}"}

    client.put(
        f"/api/users/{user_id}/pfp",
        headers=headers,
        files={"pfp": ("avatar.png", PNG_BYTES, "image/png")},
    )
    assert client.delete(f"/api/users/{user_id}/pfp", headers=headers).status_code == 200

    me = client.get("/api/users/me", headers=headers).json()["data"]
    assert me["pfp"] is None


def test_pfp_ownership_enforced(client, auth_payload):
    """Another user cannot read or modify someone else's profile picture."""
    _, victim_id = _register(client, auth_payload, "pfp-victim@example.com")
    attacker_jwt, _ = _register(client, auth_payload, "pfp-attacker@example.com")
    headers = {"Authorization": f"Bearer {attacker_jwt}"}

    assert client.get(f"/api/users/{victim_id}/pfp", headers=headers).status_code == 403
    bad = client.put(
        f"/api/users/{victim_id}/pfp",
        headers=headers,
        files={"pfp": ("avatar.png", PNG_BYTES, "image/png")},
    )
    assert bad.status_code == 403
