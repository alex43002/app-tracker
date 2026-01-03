def test_login_happy_path(client, auth_payload):
    res = client.post("/api/auth/login", json={
        "email": auth_payload["email"],
        "password": auth_payload["password"],
    })

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert "jwt" in body["data"]
