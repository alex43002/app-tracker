"""API tests for résumé ↔ job matching (FEAT-21): /api/match/score and
/api/match/scrape. Network-bound paths are monkeypatched so the suite stays
offline and deterministic."""


def _headers(jwt):
    return {"Authorization": f"Bearer {jwt}"}


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    data = res.json()["data"]
    return data["jwt"], data["user"]["id"]


def _create_job(client, headers):
    res = client.post(
        "/api/jobs/",
        headers=headers,
        json={
            "url": "https://example.com/job",
            "jobTitle": "Engineer",
            "company": "Acme",
            "salaryTarget": 100000,
            "status": "applied",
            "location": "Remote",
            "employmentType": "full-time",
        },
    )
    assert res.status_code == 200
    return res.json()["data"]["id"]


def _upload_resume(client, headers, job_id, body=b"Python developer with Django and AWS"):
    res = client.post(
        f"/api/jobs/{job_id}/resumes",
        headers=headers,
        files={"resume": ("cv.txt", body, "text/plain")},
    )
    assert res.status_code == 200
    return res.json()["data"]["id"]


# --------------------------- /score (raw text) ------------------------------

def test_score_with_raw_text(client, auth_payload):
    jwt, _ = _register(client, auth_payload, "match-rawtext@example.com")
    res = client.post(
        "/api/match/score",
        headers=_headers(jwt),
        json={
            "resumeText": "Python developer using Django and PostgreSQL.",
            "jobDescription": "We need Python, Django, and PostgreSQL skills.",
        },
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["score"] >= 80
    assert "python" in data["breakdown"]["matchedSkills"]
    assert isinstance(data["gaps"], list)


def test_score_reports_gaps(client, auth_payload):
    jwt, _ = _register(client, auth_payload, "match-gaps@example.com")
    res = client.post(
        "/api/match/score",
        headers=_headers(jwt),
        json={
            "resumeText": "I write Python scripts.",
            "jobDescription": "Required: Python, Kubernetes, and AWS.",
        },
    )
    data = res.json()["data"]
    assert "kubernetes" in data["breakdown"]["missingSkills"]
    assert "aws" in data["gaps"]


def test_score_requires_a_resume_and_a_job_source(client, auth_payload):
    jwt, _ = _register(client, auth_payload, "match-validation@example.com")
    # Missing job source.
    res = client.post(
        "/api/match/score",
        headers=_headers(jwt),
        json={"resumeText": "Python"},
    )
    assert res.status_code == 422
    assert res.json()["success"] is False


def test_score_requires_auth(client):
    res = client.post(
        "/api/match/score",
        json={"resumeText": "Python", "jobDescription": "Python"},
    )
    assert res.status_code == 401


# --------------------------- /score (uploaded résumé) -----------------------

def test_score_with_uploaded_resume_id(client, auth_payload):
    jwt, _ = _register(client, auth_payload, "match-resumeid@example.com")
    headers = _headers(jwt)
    job_id = _create_job(client, headers)
    resume_id = _upload_resume(client, headers, job_id)

    res = client.post(
        "/api/match/score",
        headers=headers,
        json={
            "resumeId": resume_id,
            "jobDescription": "Looking for Python, Django, and AWS experience.",
        },
    )
    assert res.status_code == 200
    assert res.json()["data"]["score"] > 0


def test_score_rejects_another_users_resume(client, auth_payload):
    owner_jwt, _ = _register(client, auth_payload, "match-owner@example.com")
    other_jwt, _ = _register(client, auth_payload, "match-intruder@example.com")
    owner_headers = _headers(owner_jwt)
    job_id = _create_job(client, owner_headers)
    resume_id = _upload_resume(client, owner_headers, job_id)

    res = client.post(
        "/api/match/score",
        headers=_headers(other_jwt),
        json={"resumeId": resume_id, "jobDescription": "Python role"},
    )
    assert res.status_code == 403


# --------------------------- /scrape ----------------------------------------

def test_scrape_extracts_skills(client, auth_payload, monkeypatch):
    jwt, _ = _register(client, auth_payload, "match-scrape@example.com")
    html = (
        "<html><head><title>Backend Engineer</title></head><body>"
        "<h1>Backend Engineer</h1><p>Python, FastAPI, Docker, PostgreSQL.</p>"
        "</body></html>"
    )
    monkeypatch.setattr("app.matching.service.fetch_url", lambda url: html)

    res = client.post(
        "/api/match/scrape",
        headers=_headers(jwt),
        json={"url": "https://jobs.example.com/backend"},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["title"] == "Backend Engineer"
    assert "python" in data["skills"]
    assert "fastapi" in data["skills"]
    assert data["textLength"] > 0


def test_scrape_maps_fetch_error(client, auth_payload, monkeypatch):
    from app.matching.fetch import FetchError

    jwt, _ = _register(client, auth_payload, "match-scrapefail@example.com")

    def _boom(url):
        raise FetchError("Refusing to fetch a non-public address")

    monkeypatch.setattr("app.matching.service.fetch_url", _boom)
    res = client.post(
        "/api/match/scrape",
        headers=_headers(jwt),
        json={"url": "http://internal.example/job"},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "JOB_FETCH_FAILED"


# --------------------------- /extract-resume --------------------------------

def test_extract_resume_returns_text_and_profile(client, auth_payload):
    jwt, _ = _register(client, auth_payload, "match-extract@example.com")
    res = client.post(
        "/api/match/extract-resume",
        headers=_headers(jwt),
        files={"resume": ("cv.txt", b"Python developer with Django and AWS", "text/plain")},
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["filename"] == "cv.txt"
    assert data["textLength"] > 0
    assert "python" in data["skills"]
    assert "Django" in data["text"]


def test_extract_resume_then_score_flow(client, auth_payload):
    """The extracted text can be replayed as resumeText to score an ad-hoc file."""
    jwt, _ = _register(client, auth_payload, "match-extractscore@example.com")
    headers = _headers(jwt)
    extract = client.post(
        "/api/match/extract-resume",
        headers=headers,
        files={"resume": ("cv.txt", b"Python developer using Django and PostgreSQL", "text/plain")},
    )
    resume_text = extract.json()["data"]["text"]

    res = client.post(
        "/api/match/score",
        headers=headers,
        json={
            "resumeText": resume_text,
            "jobDescription": "We need Python, Django, and PostgreSQL skills.",
        },
    )
    assert res.status_code == 200
    assert res.json()["data"]["score"] >= 80


def test_extract_resume_rejects_unsupported_type(client, auth_payload):
    jwt, _ = _register(client, auth_payload, "match-extractbadtype@example.com")
    res = client.post(
        "/api/match/extract-resume",
        headers=_headers(jwt),
        files={"resume": ("cv.png", b"\x89PNG not a resume", "image/png")},
    )
    assert res.status_code == 400
    assert res.json()["success"] is False


def test_extract_resume_requires_auth(client):
    res = client.post(
        "/api/match/extract-resume",
        files={"resume": ("cv.txt", b"Python", "text/plain")},
    )
    assert res.status_code == 401
