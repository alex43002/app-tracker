"""API tests for company research snapshots (derived from discovered postings)."""

import pytest

from app.discovery import connectors

FIXTURE = {
    "jobs": [
        {
            "id": 1,
            "title": "Backend Engineer",
            "absolute_url": "https://boards.greenhouse.io/acme/jobs/1",
            "updated_at": "2026-06-01T12:00:00Z",
            "location": {"name": "Remote"},
            "content": "Python, FastAPI, AWS, Docker. $120,000-$150,000",
        },
        {
            "id": 2,
            "title": "Data Analyst",
            "absolute_url": "https://boards.greenhouse.io/acme/jobs/2",
            "updated_at": "2026-06-02T12:00:00Z",
            "location": {"name": "New York"},
            "content": "SQL and Python and Tableau. $80,000",
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
    monkeypatch.setattr(connectors, "_get_json", lambda url: FIXTURE)


def test_snapshot_from_ingested_postings(client, auth_payload, fake_greenhouse):
    jwt = _register(client, auth_payload, "cr-snap@example.com")
    headers = _headers(jwt)
    client.post(
        "/api/discovery/ingest",
        headers=headers,
        json={"source": "greenhouse", "boardToken": "crsnapco", "companyName": "CRSnap"},
    )

    snap = client.get(
        "/api/company-research/snapshot?company=CRSnap", headers=headers
    ).json()["data"]
    assert snap["found"] is True
    assert snap["openRoles"] == 2
    assert "greenhouse" in snap["sources"]
    skill_values = {s["value"] for s in snap["topSkills"]}
    assert {"python", "aws"} <= skill_values
    # Python appears in both postings, so it's the top skill.
    assert snap["topSkills"][0]["value"] == "python"
    assert snap["salaryMin"] == 80000
    assert snap["salaryMax"] == 150000
    loc_values = {f["value"] for f in snap["locations"]}
    assert {"Remote", "New York"} <= loc_values


def test_snapshot_unknown_company(client, auth_payload):
    jwt = _register(client, auth_payload, "cr-unknown@example.com")
    snap = client.get(
        "/api/company-research/snapshot?company=NoSuchCompanyXYZ",
        headers=_headers(jwt),
    ).json()["data"]
    assert snap["found"] is False
    assert snap["openRoles"] == 0
    assert snap["topSkills"] == []


def test_company_directory(client, auth_payload, fake_greenhouse):
    jwt = _register(client, auth_payload, "cr-dir@example.com")
    headers = _headers(jwt)
    client.post(
        "/api/discovery/ingest",
        headers=headers,
        json={"source": "greenhouse", "boardToken": "crdirco", "companyName": "CRDir"},
    )
    listed = client.get(
        "/api/company-research/companies?q=crdir", headers=headers
    ).json()["data"]["companies"]
    assert any(c["name"] == "CRDir" and c["openRoles"] == 2 for c in listed)


def test_requires_auth(client):
    assert client.get("/api/company-research/snapshot?company=x").status_code == 401
