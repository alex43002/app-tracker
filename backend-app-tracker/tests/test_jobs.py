def _make_job(client, headers, **overrides):
    payload = {
        "jobId": "external-123",
        "url": "https://example.com/job",
        "jobTitle": "Software Engineer",
        "company": "Example Corp",
        "salaryTarget": 120000,
        "salaryRange": "100k-130k",
        "status": "applied",
        "resume": "base64resume",
        "location": "Remote",
        "employmentType": "full-time",
    }
    payload.update(overrides)
    return client.post("/api/jobs", headers=headers, json=payload)


def test_create_and_list_jobs(client, auth_token):
    headers = {"Authorization": f"Bearer {auth_token['jwt']}"}

    create = _make_job(client, headers)
    assert create.status_code == 200
    assert create.json()["success"] is True

    list_res = client.get("/api/jobs", headers=headers)
    assert list_res.status_code == 200
    body = list_res.json()
    assert body["success"] is True
    assert len(body["data"]["items"]) >= 1


def test_create_job_missing_required_field_returns_envelope(client, auth_token):
    """Missing required field -> standard error envelope (not FastAPI's raw 422)."""
    headers = {"Authorization": f"Bearer {auth_token['jwt']}"}

    res = client.post(
        "/api/jobs",
        headers=headers,
        json={"url": "https://example.com/job"},  # missing company, title, etc.
    )

    assert res.status_code == 422
    body = res.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"


def test_filters_cannot_override_user_scope(client, auth_token):
    """SEC-1: a client must not be able to read other users' jobs via filters."""
    headers = {"Authorization": f"Bearer {auth_token['jwt']}"}

    res = client.get(
        '/api/jobs?filters={"userId":"someone-else"}',
        headers=headers,
    )

    # userId is not a whitelisted filter field -> rejected.
    assert res.status_code == 400
    body = res.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"


def test_filters_reject_mongo_operators(client, auth_token):
    """SEC-1: operator injection in filters is rejected."""
    headers = {"Authorization": f"Bearer {auth_token['jwt']}"}

    res = client.get(
        '/api/jobs?filters={"$where":"1==1"}',
        headers=headers,
    )

    assert res.status_code == 400
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_create_job_with_notes_persists(client, auth_token):
    """FEAT-1: notes is accepted and round-trips through list."""
    headers = {"Authorization": f"Bearer {auth_token['jwt']}"}

    create = _make_job(client, headers, jobTitle="With Notes", notes="Referred by Sam")
    assert create.status_code == 200

    listed = client.get(
        '/api/jobs?pageSize=100&filters={"company":"Example Corp"}',
        headers=headers,
    ).json()["data"]["items"]
    match = [j for j in listed if j["jobTitle"] == "With Notes"]
    assert match and match[0]["notes"] == "Referred by Sam"


def test_company_filter_matches_case_insensitive_substring(client, auth_token):
    """FEAT-19: company/location filters match partial, case-insensitive text."""
    headers = {"Authorization": f"Bearer {auth_token['jwt']}"}

    _make_job(client, headers, jobTitle="At Acme", company="Acme Robotics")
    _make_job(client, headers, jobTitle="At Globex", company="Globex Inc")

    listed = client.get(
        '/api/jobs?pageSize=100&filters={"company":"acme"}',
        headers=headers,
    ).json()["data"]["items"]

    companies = {j["company"] for j in listed}
    assert "Acme Robotics" in companies
    assert "Globex Inc" not in companies


def test_resume_upload_valid_type(client, auth_token):
    """SEC-7: a valid PDF résumé is accepted via multipart."""
    headers = {"Authorization": f"Bearer {auth_token['jwt']}"}

    res = client.post(
        "/api/jobs",
        headers=headers,
        data={
            "url": "https://example.com/job",
            "jobTitle": "Multipart Role",
            "company": "Example Corp",
            "salaryTarget": "100000",
            "status": "applied",
            "location": "Remote",
            "employmentType": "full-time",
        },
        files={"resume": ("cv.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert res.status_code == 200
    assert res.json()["success"] is True


def test_resume_upload_rejects_bad_type(client, auth_token):
    """SEC-7: a disallowed résumé content type is rejected."""
    headers = {"Authorization": f"Bearer {auth_token['jwt']}"}

    res = client.post(
        "/api/jobs",
        headers=headers,
        data={
            "url": "https://example.com/job",
            "jobTitle": "Bad Upload",
            "company": "Example Corp",
            "salaryTarget": "100000",
            "status": "applied",
            "location": "Remote",
            "employmentType": "full-time",
        },
        files={"resume": ("cv.exe", b"MZ", "application/x-msdownload")},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"
