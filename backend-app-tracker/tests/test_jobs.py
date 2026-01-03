def test_create_and_list_jobs(client, auth_token):
    headers = {"Authorization": f"Bearer {auth_token['jwt']}"}

    create = client.post(
        "/api/jobs",
        headers=headers,
        json={
            "jobId": "external-123",
            "url": "https://example.com/job",
            "jobTitle": "Software Engineer",
            "salaryTarget": 120000,
            "salaryRange": "100k-130k",
            "status": "applied",
            "resume": "base64resume",
            "location": "Remote",
            "employmentType": "full-time",
        },
    )

    assert create.status_code == 200
    assert create.json()["success"] is True

    list_res = client.get("/api/jobs", headers=headers)
    assert list_res.status_code == 200
    body = list_res.json()
    assert body["success"] is True
    assert len(body["data"]["items"]) >= 1
