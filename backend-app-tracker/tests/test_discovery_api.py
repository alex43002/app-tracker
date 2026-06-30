"""API tests for discovery (FEAT-22): /api/discovery/ingest, /jobs, /sources.
The ATS fetch is monkeypatched so the suite stays offline."""

import pytest

from app.discovery import connectors

GREENHOUSE_FIXTURE = {
    "jobs": [
        {
            "id": 1,
            "title": "Backend Engineer",
            "absolute_url": "https://boards.greenhouse.io/acme/jobs/1",
            "updated_at": "2026-06-01T12:00:00Z",
            "location": {"name": "Remote"},
            "content": "Python, FastAPI, AWS. $120,000-$150,000",
        },
        {
            "id": 2,
            "title": "Data Analyst",
            "absolute_url": "https://boards.greenhouse.io/acme/jobs/2",
            "updated_at": "2026-06-02T12:00:00Z",
            "location": {"name": "New York"},
            "content": "SQL and Tableau. $80,000",
        },
    ]
}


def _headers(jwt):
    return {"Authorization": f"Bearer {jwt}"}


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    return res.json()["data"]["jwt"]


@pytest.fixture
def fake_greenhouse(monkeypatch):
    monkeypatch.setattr(connectors, "_get_json", lambda url: GREENHOUSE_FIXTURE)


def test_list_sources(client, auth_payload):
    jwt = _register(client, auth_payload, "disc-sources@example.com")
    res = client.get("/api/discovery/sources", headers=_headers(jwt))
    assert res.status_code == 200
    sources = res.json()["data"]["sources"]
    assert "greenhouse" in sources and "lever" in sources


def test_ingest_then_list(client, auth_payload, fake_greenhouse):
    jwt = _register(client, auth_payload, "disc-ingest@example.com")
    headers = _headers(jwt)

    res = client.post(
        "/api/discovery/ingest",
        headers=headers,
        json={"source": "greenhouse", "boardToken": "acme", "companyName": "Acme"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["fetched"] == 2 and data["inserted"] == 2 and data["updated"] == 0

    listed = client.get("/api/discovery/jobs", headers=headers).json()["data"]
    titles = {j["title"] for j in listed["items"]}
    assert {"Backend Engineer", "Data Analyst"} <= titles
    assert listed["meta"]["totalItems"] >= 2


def test_ingest_is_idempotent(client, auth_payload, fake_greenhouse):
    jwt = _register(client, auth_payload, "disc-idem@example.com")
    headers = _headers(jwt)
    body = {"source": "greenhouse", "boardToken": "idemco"}

    first = client.post("/api/discovery/ingest", headers=headers, json=body).json()[
        "data"
    ]
    assert first["inserted"] == 2
    # Re-ingesting the same board upserts (no duplicates, no new inserts).
    second = client.post("/api/discovery/ingest", headers=headers, json=body).json()[
        "data"
    ]
    assert second["inserted"] == 0

    listed = client.get(
        "/api/discovery/jobs?company=idemco", headers=headers
    ).json()["data"]
    assert listed["meta"]["totalItems"] == 2


def test_filters_by_salary_and_query(client, auth_payload, fake_greenhouse):
    jwt = _register(client, auth_payload, "disc-filter@example.com")
    headers = _headers(jwt)
    client.post(
        "/api/discovery/ingest",
        headers=headers,
        json={"source": "greenhouse", "boardToken": "filterco"},
    )

    # salaryMin filters out the $80k Data Analyst.
    high = client.get(
        "/api/discovery/jobs?company=filterco&salaryMin=100000", headers=headers
    ).json()["data"]
    assert [j["title"] for j in high["items"]] == ["Backend Engineer"]

    # Text query on the title.
    q = client.get(
        "/api/discovery/jobs?company=filterco&q=analyst", headers=headers
    ).json()["data"]
    assert [j["title"] for j in q["items"]] == ["Data Analyst"]


def test_filter_by_work_arrangement(client, auth_payload, fake_greenhouse):
    """FEAT-24: remote/onsite filtering via the derived workArrangement field."""
    jwt = _register(client, auth_payload, "disc-remote@example.com")
    headers = _headers(jwt)
    client.post(
        "/api/discovery/ingest",
        headers=headers,
        json={"source": "greenhouse", "boardToken": "remoteco"},
    )

    # The Backend Engineer posting is "Remote"; the Data Analyst is "New York".
    remote = client.get(
        "/api/discovery/jobs?company=remoteco&workArrangement=remote",
        headers=headers,
    ).json()["data"]
    assert [j["title"] for j in remote["items"]] == ["Backend Engineer"]
    assert remote["items"][0]["workArrangement"] == "remote"


def test_ingest_unsupported_source(client, auth_payload):
    jwt = _register(client, auth_payload, "disc-bad@example.com")
    res = client.post(
        "/api/discovery/ingest",
        headers=_headers(jwt),
        json={"source": "workday", "boardToken": "acme"},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "UNSUPPORTED_SOURCE"


def test_ingest_fetch_failure_maps_to_error(client, auth_payload, monkeypatch):
    jwt = _register(client, auth_payload, "disc-fail@example.com")

    def _boom(url):
        raise connectors.ConnectorError("Unknown company board for this source")

    monkeypatch.setattr(connectors, "_get_json", _boom)
    res = client.post(
        "/api/discovery/ingest",
        headers=_headers(jwt),
        json={"source": "greenhouse", "boardToken": "ghost"},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "DISCOVERY_FETCH_FAILED"


def test_resolve_board_from_url(client, auth_payload):
    jwt = _register(client, auth_payload, "disc-resolve@example.com")
    res = client.post(
        "/api/discovery/resolve",
        headers=_headers(jwt),
        json={"url": "https://boards.greenhouse.io/stripe/jobs/1"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data == {"source": "greenhouse", "boardToken": "stripe"}


def test_resolve_board_rejects_unknown_url(client, auth_payload):
    jwt = _register(client, auth_payload, "disc-resolve-bad@example.com")
    res = client.post(
        "/api/discovery/resolve",
        headers=_headers(jwt),
        json={"url": "https://example.com/careers"},
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_company_directory_search(client, auth_payload):
    jwt = _register(client, auth_payload, "disc-companies@example.com")
    headers = _headers(jwt)

    all_res = client.get("/api/discovery/companies", headers=headers).json()["data"]
    assert len(all_res["companies"]) >= 1

    stripe = client.get(
        "/api/discovery/companies?q=stripe", headers=headers
    ).json()["data"]["companies"]
    assert any(c["name"] == "Stripe" for c in stripe)


def test_resolve_requires_auth(client):
    assert (
        client.post(
            "/api/discovery/resolve",
            json={"url": "https://boards.greenhouse.io/stripe"},
        ).status_code
        == 401
    )


def test_discovery_requires_auth(client):
    assert client.get("/api/discovery/jobs").status_code == 401
    assert (
        client.post(
            "/api/discovery/ingest",
            json={"source": "greenhouse", "boardToken": "acme"},
        ).status_code
        == 401
    )
