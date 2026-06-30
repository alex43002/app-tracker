"""API tests for discovery dedupe-collapse + eligibility/quality filters
(FEAT-22). ATS fetches are monkeypatched per URL so the suite stays offline."""

import pytest

from app.discovery import connectors

# Same role ("Backend Engineer" @ "DupCo" / "Remote") posted on both Greenhouse
# and Lever — these should collapse into one listing.
GREENHOUSE = {
    "jobs": [
        {
            "id": 1,
            "title": "Backend Engineer",
            "absolute_url": "https://boards.greenhouse.io/dupco/jobs/1",
            "updated_at": "2026-06-10T12:00:00Z",
            "location": {"name": "Remote"},
            "content": "Senior role. 7+ years. Bachelor's degree required. "
            + "Python and AWS. $150,000-$180,000. " * 10,
        }
    ]
}
LEVER = [
    {
        "id": "x1",
        "text": "Backend Engineer",
        "hostedUrl": "https://jobs.lever.co/dupco/x1",
        "categories": {"location": "Remote", "commitment": "Full-time"},
        "descriptionPlain": "Senior role. 7+ years. Bachelor's degree required. "
        + "Python and AWS. $150,000-$180,000. " * 10,
        "createdAt": 1717900000000,
    }
]


def _headers(jwt):
    return {"Authorization": f"Bearer {jwt}"}


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    return res.json()["data"]["jwt"]


@pytest.fixture
def fake_both_sources(monkeypatch):
    def _dispatch(url: str):
        if "greenhouse" in url:
            return GREENHOUSE
        return LEVER

    monkeypatch.setattr(connectors, "_get_json", _dispatch)


def _ingest_both(client, headers):
    client.post(
        "/api/discovery/ingest",
        headers=headers,
        json={"source": "greenhouse", "boardToken": "dupco", "companyName": "DupCo"},
    )
    client.post(
        "/api/discovery/ingest",
        headers=headers,
        json={"source": "lever", "boardToken": "dupco", "companyName": "DupCo"},
    )


def test_duplicates_collapse_into_one_listing(client, auth_payload, fake_both_sources):
    jwt = _register(client, auth_payload, "disc-dedupe@example.com")
    headers = _headers(jwt)
    _ingest_both(client, headers)

    listed = client.get(
        "/api/discovery/jobs?company=DupCo", headers=headers
    ).json()["data"]
    assert listed["meta"]["totalItems"] == 1
    item = listed["items"][0]
    assert item["duplicateCount"] == 2
    sources = {s["source"] for s in item["sources"]}
    assert sources == {"greenhouse", "lever"}


def test_collapse_false_returns_raw_rows(client, auth_payload, fake_both_sources):
    jwt = _register(client, auth_payload, "disc-nocollapse@example.com")
    headers = _headers(jwt)
    _ingest_both(client, headers)

    raw = client.get(
        "/api/discovery/jobs?company=DupCo&collapse=false", headers=headers
    ).json()["data"]
    assert raw["meta"]["totalItems"] == 2


def test_enrichment_fields_present_and_filterable(
    client, auth_payload, fake_both_sources
):
    jwt = _register(client, auth_payload, "disc-enrich@example.com")
    headers = _headers(jwt)
    _ingest_both(client, headers)

    item = client.get(
        "/api/discovery/jobs?company=DupCo", headers=headers
    ).json()["data"]["items"][0]
    assert item["experienceLevel"] == "senior"
    assert item["requiresDegree"] is True
    assert item["qualityScore"] == 100

    # Eligibility filters narrow / exclude correctly.
    assert (
        client.get(
            "/api/discovery/jobs?company=DupCo&experienceLevel=senior",
            headers=headers,
        ).json()["data"]["meta"]["totalItems"]
        == 1
    )
    assert (
        client.get(
            "/api/discovery/jobs?company=DupCo&experienceLevel=entry",
            headers=headers,
        ).json()["data"]["meta"]["totalItems"]
        == 0
    )
    assert (
        client.get(
            "/api/discovery/jobs?company=DupCo&requiresDegree=false",
            headers=headers,
        ).json()["data"]["meta"]["totalItems"]
        == 0
    )


def test_min_quality_filter(client, auth_payload, monkeypatch):
    # A deliberately low-quality posting (no salary, thin desc, no location).
    low = {
        "jobs": [
            {
                "id": 99,
                "title": "Helper",
                "absolute_url": "https://boards.greenhouse.io/lowco/jobs/99",
                "updated_at": "2026-06-10T12:00:00Z",
                "location": {"name": ""},
                "content": "short",
            }
        ]
    }
    monkeypatch.setattr(connectors, "_get_json", lambda url: low)
    jwt = _register(client, auth_payload, "disc-quality@example.com")
    headers = _headers(jwt)
    client.post(
        "/api/discovery/ingest",
        headers=headers,
        json={"source": "greenhouse", "boardToken": "lowco", "companyName": "LowCo"},
    )

    # The posting exists…
    assert (
        client.get(
            "/api/discovery/jobs?company=LowCo", headers=headers
        ).json()["data"]["meta"]["totalItems"]
        == 1
    )
    # …but is filtered out when we demand decent quality.
    assert (
        client.get(
            "/api/discovery/jobs?company=LowCo&minQuality=80", headers=headers
        ).json()["data"]["meta"]["totalItems"]
        == 0
    )
