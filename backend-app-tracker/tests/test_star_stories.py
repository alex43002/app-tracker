"""API tests for the STAR story library (interview prep)."""


def _headers(jwt):
    return {"Authorization": f"Bearer {jwt}"}


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    return res.json()["data"]["jwt"]


def test_create_list_update_delete(client, auth_payload):
    jwt = _register(client, auth_payload, "star-crud@example.com")
    headers = _headers(jwt)

    created = client.post(
        "/api/star-stories/",
        headers=headers,
        json={
            "title": "Led a migration",
            "situation": "Legacy system",
            "task": "Migrate it",
            "action": "Built a plan",
            "result": "Zero downtime",
            "tags": ["leadership", "Leadership", " "],
        },
    ).json()["data"]
    assert created["title"] == "Led a migration"
    # Tags trimmed + de-duped (case-insensitive).
    assert created["tags"] == ["leadership"]
    story_id = created["id"]

    listed = client.get("/api/star-stories/", headers=headers).json()["data"]
    assert [s["id"] for s in listed["items"]] == [story_id]

    updated = client.put(
        f"/api/star-stories/{story_id}",
        headers=headers,
        json={"result": "Saved $1M/yr"},
    ).json()["data"]
    assert updated["result"] == "Saved $1M/yr"
    assert updated["title"] == "Led a migration"

    assert (
        client.delete(f"/api/star-stories/{story_id}", headers=headers).status_code
        == 200
    )
    empty = client.get("/api/star-stories/", headers=headers).json()["data"]
    assert empty["items"] == []


def test_title_required(client, auth_payload):
    jwt = _register(client, auth_payload, "star-validate@example.com")
    res = client.post(
        "/api/star-stories/", headers=_headers(jwt), json={"title": ""}
    )
    assert res.status_code == 422


def test_stories_are_per_user(client, auth_payload):
    jwt_a = _register(client, auth_payload, "star-a@example.com")
    jwt_b = _register(client, auth_payload, "star-b@example.com")

    created = client.post(
        "/api/star-stories/", headers=_headers(jwt_a), json={"title": "A's story"}
    ).json()["data"]

    # B can't see or mutate A's story.
    b_list = client.get("/api/star-stories/", headers=_headers(jwt_b)).json()["data"]
    assert b_list["items"] == []
    assert (
        client.delete(
            f"/api/star-stories/{created['id']}", headers=_headers(jwt_b)
        ).status_code
        == 404
    )


def test_requires_auth(client):
    assert client.get("/api/star-stories/").status_code == 401
