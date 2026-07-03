"""Tests for email-based application tracking (deterministic classifier)."""

import pytest

from app.email_tracking.classifier import classify_email


def _headers(jwt):
    return {"Authorization": f"Bearer {jwt}"}


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    return res.json()["data"]["jwt"]


@pytest.mark.parametrize(
    "text,category,status",
    [
        (
            "Unfortunately, we have decided to move forward with other candidates.",
            "rejection",
            "rejected",
        ),
        (
            "We'd like to invite you to an interview. What's your availability for a call?",
            "interview",
            "interviewing",
        ),
        (
            "Thank you for applying! Your application has been received.",
            "application_received",
            "applied",
        ),
        (
            "We are pleased to offer you the position. Your offer letter is attached.",
            "offer",
            "offer",
        ),
        (
            "I came across your profile and wanted to reach out about an exciting role.",
            "recruiter",
            None,
        ),
        ("Here is the lunch menu for Friday.", "other", None),
    ],
)
def test_classifier_categories(text, category, status):
    result = classify_email(text)
    assert result["category"] == category
    assert result["suggestedStatus"] == status


def test_rejection_beats_interview_mention():
    # A rejection that references the interview should still read as a rejection.
    text = "Thank you for taking the time to interview. Unfortunately we won't be moving forward."
    assert classify_email(text)["category"] == "rejection"


def test_classify_endpoint_matches_jobs(client, auth_payload):
    jwt = _register(client, auth_payload, "email-match@example.com")
    headers = _headers(jwt)
    client.post(
        "/api/jobs/",
        headers=headers,
        json={
            "url": "https://example.com/jobs/1",
            "jobTitle": "Engineer",
            "company": "Globex",
            "salaryTarget": 100000,
            "status": "applied",
            "location": "Remote",
            "employmentType": "full-time",
        },
    )

    res = client.post(
        "/api/email-tracking/classify",
        headers=headers,
        json={
            "subject": "Your interview with Globex",
            "text": "The Globex team would like to schedule an interview with you.",
        },
    )
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["category"] == "interview"
    assert data["suggestedStatus"] == "interviewing"
    assert [m["company"] for m in data["matchedJobs"]] == ["Globex"]


def test_classify_requires_text(client, auth_payload):
    jwt = _register(client, auth_payload, "email-empty@example.com")
    res = client.post(
        "/api/email-tracking/classify", headers=_headers(jwt), json={"text": ""}
    )
    assert res.status_code == 422


def test_requires_auth(client):
    assert (
        client.post(
            "/api/email-tracking/classify", json={"text": "hi"}
        ).status_code
        == 401
    )
