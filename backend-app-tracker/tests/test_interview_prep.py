"""API tests for the interview preparation workspace (deterministic generator)."""


def _headers(jwt):
    return {"Authorization": f"Bearer {jwt}"}


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    return res.json()["data"]["jwt"]


JD = (
    "We are hiring a Senior Backend Engineer. You will build services in Python "
    "and FastAPI, deploy on AWS with Docker and Kubernetes, and work with "
    "PostgreSQL. Strong communication and leadership skills required; you will "
    "mentor junior engineers and own project delivery."
)


def test_generate_prep(client, auth_payload):
    jwt = _register(client, auth_payload, "prep-gen@example.com")
    res = client.post(
        "/api/interview-prep/generate",
        headers=_headers(jwt),
        json={"jobDescription": JD, "jobTitle": "Senior Backend Engineer"},
    )
    assert res.status_code == 200
    data = res.json()["data"]

    topic_names = {t["name"] for t in data["topics"]}
    # Skills the matching engine should pull out of the JD.
    assert {"python", "aws", "docker"} <= topic_names
    assert any(t["kind"] == "skill" for t in data["topics"])

    # Curated python question shows up among the technical prompts.
    assert any("Python" in q for q in data["technicalQuestions"])
    # Behavioral questions are always present (generic + soft-skill driven).
    assert len(data["behavioralQuestions"]) > 0
    # Leadership is detected in the JD, so its behavioral prompts surface.
    assert any("led a project" in q.lower() for q in data["behavioralQuestions"])
    # Notes mention the role title.
    assert "Senior Backend Engineer" in data["notes"]


def test_generate_is_deterministic(client, auth_payload):
    jwt = _register(client, auth_payload, "prep-determ@example.com")
    body = {"jobDescription": JD}
    first = client.post(
        "/api/interview-prep/generate", headers=_headers(jwt), json=body
    ).json()["data"]
    second = client.post(
        "/api/interview-prep/generate", headers=_headers(jwt), json=body
    ).json()["data"]
    assert first == second


def test_empty_description_rejected(client, auth_payload):
    jwt = _register(client, auth_payload, "prep-empty@example.com")
    res = client.post(
        "/api/interview-prep/generate",
        headers=_headers(jwt),
        json={"jobDescription": ""},
    )
    assert res.status_code == 422


def test_requires_auth(client):
    assert (
        client.post(
            "/api/interview-prep/generate", json={"jobDescription": "x"}
        ).status_code
        == 401
    )
