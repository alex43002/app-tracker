def test_get_user_happy_path(client, auth_token):
    headers = {"Authorization": f"Bearer {auth_token['jwt']}"}
    res = client.get(f"/api/users/{auth_token['userId']}", headers=headers)

    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["data"]["id"] == auth_token["userId"]
