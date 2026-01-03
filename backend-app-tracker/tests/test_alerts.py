from datetime import datetime, timedelta

def test_create_and_list_alerts(client, auth_token):
    headers = {"Authorization": f"Bearer {auth_token['jwt']}"}

    create = client.post(
        "/api/alerts",
        headers=headers,
        json={
            "scheduledAlert": (datetime.utcnow() + timedelta(days=1)).isoformat(),
            "smsOrEmail": "email",
            "message": "Test alert",
        },
    )

    assert create.status_code == 200
    assert create.json()["success"] is True

    list_res = client.get("/api/alerts", headers=headers)
    assert list_res.status_code == 200
    body = list_res.json()
    assert body["success"] is True
    assert len(body["data"]["items"]) >= 1
