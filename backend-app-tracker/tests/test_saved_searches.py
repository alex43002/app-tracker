"""Saved searches (FEAT-11)."""


def _headers(jwt):
    return {"Authorization": f"Bearer {jwt}"}


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    return res.json()["data"]["jwt"]


def test_create_list_update_delete_saved_search(client, auth_payload):
    headers = _headers(_register(client, auth_payload, "ss-crud@example.com"))

    created = client.post(
        "/api/saved-searches/",
        headers=headers,
        json={
            "name": "Remote offers",
            "filters": {"status": "offer", "location": "Remote"},
            "sortBy": "company",
            "sortOrder": "desc",
        },
    )
    assert created.status_code == 200
    search = created.json()["data"]
    assert search["name"] == "Remote offers"
    assert search["filters"] == {"status": "offer", "location": "Remote"}
    search_id = search["id"]

    listed = client.get("/api/saved-searches/", headers=headers).json()["data"]
    assert [s["id"] for s in listed["items"]] == [search_id]

    updated = client.put(
        f"/api/saved-searches/{search_id}",
        headers=headers,
        json={"name": "Renamed", "sortOrder": "asc"},
    )
    assert updated.status_code == 200
    body = updated.json()["data"]
    assert body["name"] == "Renamed"
    assert body["sortOrder"] == "asc"
    assert body["sortBy"] == "company"  # untouched fields preserved

    deleted = client.delete(f"/api/saved-searches/{search_id}", headers=headers)
    assert deleted.status_code == 200
    assert client.get("/api/saved-searches/", headers=headers).json()["data"][
        "items"
    ] == []


def test_saved_search_rejects_unwhitelisted_filter(client, auth_payload):
    """FEAT-11 builds on the hardened filter mechanism (SEC-1)."""
    headers = _headers(_register(client, auth_payload, "ss-filter@example.com"))

    res = client.post(
        "/api/saved-searches/",
        headers=headers,
        json={"name": "Bad", "filters": {"userId": "someone-else"}},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_saved_search_rejects_mongo_operator(client, auth_payload):
    headers = _headers(_register(client, auth_payload, "ss-op@example.com"))

    res = client.post(
        "/api/saved-searches/",
        headers=headers,
        json={"name": "Bad", "filters": {"status": {"$ne": "rejected"}}},
    )
    assert res.status_code == 400


def test_saved_search_rejects_bad_sort_field(client, auth_payload):
    headers = _headers(_register(client, auth_payload, "ss-sort@example.com"))

    res = client.post(
        "/api/saved-searches/",
        headers=headers,
        json={"name": "Bad", "sortBy": "salaryTarget"},
    )
    assert res.status_code == 400


def test_saved_searches_are_per_user(client, auth_payload):
    owner = _headers(_register(client, auth_payload, "ss-owner@example.com"))
    other = _headers(_register(client, auth_payload, "ss-other@example.com"))

    created = client.post(
        "/api/saved-searches/",
        headers=owner,
        json={"name": "Mine", "filters": {"status": "applied"}},
    )
    search_id = created.json()["data"]["id"]

    # Another user can't see or mutate it.
    assert client.get("/api/saved-searches/", headers=other).json()["data"][
        "items"
    ] == []
    assert client.delete(
        f"/api/saved-searches/{search_id}", headers=other
    ).status_code == 404
