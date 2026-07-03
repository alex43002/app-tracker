"""API tests for the offer comparison tool."""


def _headers(jwt):
    return {"Authorization": f"Bearer {jwt}"}


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    return res.json()["data"]["jwt"]


def test_create_computes_total_comp(client, auth_payload):
    jwt = _register(client, auth_payload, "offer-total@example.com")
    created = client.post(
        "/api/offers/",
        headers=_headers(jwt),
        json={
            "company": "Acme",
            "role": "Engineer",
            "baseSalary": 150000,
            "bonus": 20000,
            "equityPerYear": 30000,
            "signOnBonus": 10000,
            "fitRating": 4,
        },
    ).json()["data"]
    # Total comp is the annual recurring sum (sign-on excluded).
    assert created["totalComp"] == 200000
    assert created["fitRating"] == 4
    assert created["status"] == "received"


def test_crud_and_isolation(client, auth_payload):
    jwt_a = _register(client, auth_payload, "offer-a@example.com")
    jwt_b = _register(client, auth_payload, "offer-b@example.com")

    created = client.post(
        "/api/offers/",
        headers=_headers(jwt_a),
        json={"company": "Acme", "role": "Engineer"},
    ).json()["data"]
    oid = created["id"]

    updated = client.put(
        f"/api/offers/{oid}",
        headers=_headers(jwt_a),
        json={"status": "accepted", "baseSalary": 120000},
    ).json()["data"]
    assert updated["status"] == "accepted"
    assert updated["totalComp"] == 120000

    # B is isolated from A's offers.
    assert client.get("/api/offers/", headers=_headers(jwt_b)).json()["data"][
        "items"
    ] == []
    assert (
        client.delete(f"/api/offers/{oid}", headers=_headers(jwt_b)).status_code == 404
    )

    assert client.delete(f"/api/offers/{oid}", headers=_headers(jwt_a)).status_code == 200


def test_validation(client, auth_payload):
    jwt = _register(client, auth_payload, "offer-validate@example.com")
    headers = _headers(jwt)

    # Missing required role.
    assert (
        client.post(
            "/api/offers/", headers=headers, json={"company": "Acme"}
        ).status_code
        == 422
    )
    # Rating out of range.
    assert (
        client.post(
            "/api/offers/",
            headers=headers,
            json={"company": "Acme", "role": "Eng", "fitRating": 9},
        ).status_code
        == 422
    )
    # Bad status.
    assert (
        client.post(
            "/api/offers/",
            headers=headers,
            json={"company": "Acme", "role": "Eng", "status": "bogus"},
        ).status_code
        == 400
    )


def test_requires_auth(client):
    assert client.get("/api/offers/").status_code == 401
