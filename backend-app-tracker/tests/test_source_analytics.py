"""Tests for source performance analytics (which channels produce results)."""

from app.analytics.sources import source_from_url


def _headers(jwt):
    return {"Authorization": f"Bearer {jwt}"}


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    return res.json()["data"]["jwt"]


def _create_job(client, jwt, *, url, status, title="Engineer", company="Acme"):
    res = client.post(
        "/api/jobs/",
        headers=_headers(jwt),
        json={
            "url": url,
            "jobTitle": title,
            "company": company,
            "salaryTarget": 100000,
            "status": status,
            "location": "Remote",
            "employmentType": "full-time",
        },
    )
    assert res.status_code == 200


def test_source_from_url_classification():
    assert source_from_url("https://www.linkedin.com/jobs/view/123") == "LinkedIn"
    assert source_from_url("https://boards.greenhouse.io/acme/jobs/1") == "Greenhouse"
    assert source_from_url("https://acme.myworkdayjobs.com/careers/job/1") == "Workday"
    assert source_from_url("https://careers.stripe.com/jobs/1") == "stripe.com"
    assert source_from_url("") == "Direct / other"
    assert source_from_url(None) == "Direct / other"


def test_source_performance_endpoint(client, auth_payload):
    jwt = _register(client, auth_payload, "src-perf@example.com")

    # Two LinkedIn jobs (one reached interview), one Indeed job (offer).
    _create_job(client, jwt, url="https://www.linkedin.com/jobs/1", status="applied")
    _create_job(
        client, jwt, url="https://www.linkedin.com/jobs/2", status="interviewing"
    )
    _create_job(client, jwt, url="https://www.indeed.com/jobs/3", status="offer")

    data = client.get(
        "/api/analytics/source-performance", headers=_headers(jwt)
    ).json()["data"]
    by_source = {s["source"]: s for s in data["sources"]}

    assert by_source["LinkedIn"]["total"] == 2
    assert by_source["LinkedIn"]["interviewing"] == 1
    assert by_source["LinkedIn"]["interviewRate"] == 0.5
    assert by_source["Indeed"]["total"] == 1
    assert by_source["Indeed"]["offerRate"] == 1.0

    # Busiest channel (LinkedIn, 2 jobs) is listed first.
    assert data["sources"][0]["source"] == "LinkedIn"


def test_source_performance_requires_auth(client):
    assert client.get("/api/analytics/source-performance").status_code == 401
