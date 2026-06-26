"""Multiple résumés per job (FEAT-10)."""


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


def _upload(client, headers, job_id, name="cv.pdf"):
    return client.post(
        f"/api/jobs/{job_id}/resumes",
        headers=headers,
        files={"resume": (name, b"%PDF-1.4 fake", "application/pdf")},
    )


def test_attach_multiple_resumes_and_list(client, auth_payload):
    jwt, _ = _register(client, auth_payload, "feat10-multi@example.com")
    headers = _headers(jwt)
    job_id = _create_job(client, headers)

    first = _upload(client, headers, job_id, "resume-a.pdf")
    second = _upload(client, headers, job_id, "resume-b.pdf")
    assert first.status_code == 200 and second.status_code == 200

    listed = client.get(f"/api/jobs/{job_id}/resumes", headers=headers).json()["data"]
    names = [r["filename"] for r in listed["resumes"]]
    assert names == ["resume-a.pdf", "resume-b.pdf"]
    # Each entry carries enough metadata to render a preview list.
    assert all(r["contentType"] == "application/pdf" and r["size"] > 0
               for r in listed["resumes"])


def test_uploaded_resume_is_downloadable_and_previewable(client, auth_payload):
    jwt, _ = _register(client, auth_payload, "feat10-download@example.com")
    headers = _headers(jwt)
    job_id = _create_job(client, headers)

    resume_id = _upload(client, headers, job_id).json()["data"]["id"]

    # Default download is an attachment…
    dl = client.get(f"/api/resumes/{resume_id}", headers=headers)
    assert dl.status_code == 200
    assert dl.headers["content-disposition"].startswith("attachment")

    # …and inline disposition supports the in-app preview.
    preview = client.get(
        f"/api/resumes/{resume_id}?disposition=inline", headers=headers
    )
    assert preview.status_code == 200
    assert preview.headers["content-disposition"].startswith("inline")


def test_delete_one_resume_leaves_the_other(client, auth_payload):
    jwt, _ = _register(client, auth_payload, "feat10-delete@example.com")
    headers = _headers(jwt)
    job_id = _create_job(client, headers)

    a = _upload(client, headers, job_id, "a.pdf").json()["data"]["id"]
    _upload(client, headers, job_id, "b.pdf")

    deleted = client.delete(f"/api/jobs/{job_id}/resumes/{a}", headers=headers)
    assert deleted.status_code == 200

    remaining = client.get(f"/api/jobs/{job_id}/resumes", headers=headers).json()[
        "data"
    ]["resumes"]
    assert [r["filename"] for r in remaining] == ["b.pdf"]

    # The deleted résumé's bytes are gone from GridFS too.
    assert client.get(f"/api/resumes/{a}", headers=headers).status_code == 404


def test_resume_endpoints_enforce_ownership(client, auth_payload):
    owner_jwt, _ = _register(client, auth_payload, "feat10-owner@example.com")
    other_jwt, _ = _register(client, auth_payload, "feat10-other@example.com")
    owner_headers = _headers(owner_jwt)
    job_id = _create_job(client, owner_headers)

    # Another user can't enumerate or upload résumés on someone else's job.
    assert client.get(
        f"/api/jobs/{job_id}/resumes", headers=_headers(other_jwt)
    ).status_code == 404
    assert _upload(client, _headers(other_jwt), job_id).status_code == 404


def test_legacy_single_resume_surfaces_in_list(client, auth_payload):
    """A résumé attached at create time (legacy single field) still appears."""
    jwt, _ = _register(client, auth_payload, "feat10-legacy@example.com")
    headers = _headers(jwt)

    created = client.post(
        "/api/jobs/",
        headers=headers,
        data={
            "url": "https://example.com/job",
            "jobTitle": "Legacy",
            "company": "Acme",
            "salaryTarget": "100000",
            "status": "applied",
            "location": "Remote",
            "employmentType": "full-time",
        },
        files={"resume": ("legacy.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    job_id = created.json()["data"]["id"]

    listed = client.get(f"/api/jobs/{job_id}/resumes", headers=headers).json()["data"]
    assert [r["filename"] for r in listed["resumes"]] == ["legacy.pdf"]
