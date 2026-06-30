"""Saved discovery searches + job alerts (FEAT-22): CRUD, new-match detection,
manual check, and background delivery."""

from datetime import datetime, timezone

import pytest

from app.discovery import connectors
from app.job_alerts.service import process_due_job_alerts

GREENHOUSE = {
    "jobs": [
        {
            "id": 1,
            "title": "Backend Engineer",
            "absolute_url": "https://boards.greenhouse.io/x/jobs/1",
            "updated_at": "2026-06-10T12:00:00Z",
            "location": {"name": "Remote"},
            "content": "Python and AWS. " * 40,
        }
    ]
}


class RecordingNotifier:
    def __init__(self):
        self.sent = []

    def send(self, channel, recipient, message):
        self.sent.append((channel, recipient, message))


def _headers(jwt):
    return {"Authorization": f"Bearer {jwt}"}


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    data = res.json()["data"]
    return data["jwt"], data["user"]["id"]


@pytest.fixture
def fake_greenhouse(monkeypatch):
    monkeypatch.setattr(connectors, "_get_json", lambda url: GREENHOUSE)


def _ingest(client, headers, token, company):
    return client.post(
        "/api/discovery/ingest",
        headers=headers,
        json={"source": "greenhouse", "boardToken": token, "companyName": company},
    )


# --------------------------- CRUD ------------------------------------------

def test_job_alert_crud_and_criteria_cleaning(client, auth_payload):
    jwt, _ = _register(client, auth_payload, "ja-crud@example.com")
    headers = _headers(jwt)

    created = client.post(
        "/api/job-alerts/",
        headers=headers,
        json={
            "name": "Remote Python",
            # 'bogus' is not an allowed criteria field and must be dropped.
            "criteria": {"q": "engineer", "location": "Remote", "bogus": "x"},
        },
    ).json()["data"]
    assert created["name"] == "Remote Python"
    assert created["criteria"] == {"q": "engineer", "location": "Remote"}
    assert created["notify"] is True

    listed = client.get("/api/job-alerts/", headers=headers).json()["data"]
    assert len(listed["items"]) == 1

    updated = client.put(
        f"/api/job-alerts/{created['id']}",
        headers=headers,
        json={"notify": False},
    ).json()["data"]
    assert updated["notify"] is False

    deleted = client.delete(f"/api/job-alerts/{created['id']}", headers=headers)
    assert deleted.status_code == 200
    assert client.get("/api/job-alerts/", headers=headers).json()["data"]["items"] == []


def test_job_alerts_require_auth(client):
    assert client.get("/api/job-alerts/").status_code == 401


def test_job_alerts_are_per_user(client, auth_payload):
    a_jwt, _ = _register(client, auth_payload, "ja-a@example.com")
    b_jwt, _ = _register(client, auth_payload, "ja-b@example.com")
    client.post(
        "/api/job-alerts/",
        headers=_headers(a_jwt),
        # notify off so this catch-all alert doesn't fire in delivery tests that
        # share the session database.
        json={"name": "Mine", "criteria": {}, "notify": False},
    )
    b_list = client.get("/api/job-alerts/", headers=_headers(b_jwt)).json()["data"]
    assert b_list["items"] == []


# --------------------------- check (manual) --------------------------------

def test_check_reports_only_new_matches(client, auth_payload, fake_greenhouse):
    jwt, _ = _register(client, auth_payload, "ja-check@example.com")
    headers = _headers(jwt)

    # Scope to a company unique to this test — the discovered_jobs collection is
    # shared across the session.
    alert = client.post(
        "/api/job-alerts/",
        headers=headers,
        json={"name": "Engineers", "criteria": {"company": "CheckCo"}, "notify": False},
    ).json()["data"]

    # No matching postings yet → no matches.
    first = client.post(
        f"/api/job-alerts/{alert['id']}/check", headers=headers
    ).json()["data"]
    assert first["newMatches"] == 0 and first["total"] == 0

    # Ingest a matching posting, then check again → it's new.
    _ingest(client, headers, "checkco", "CheckCo")
    second = client.post(
        f"/api/job-alerts/{alert['id']}/check", headers=headers
    ).json()["data"]
    assert second["newMatches"] == 1 and second["total"] == 1

    # Checking again with nothing newly ingested → no *new* matches, total holds.
    third = client.post(
        f"/api/job-alerts/{alert['id']}/check", headers=headers
    ).json()["data"]
    assert third["newMatches"] == 0 and third["total"] == 1


# --------------------------- background delivery ---------------------------

def test_process_due_job_alerts_notifies_owner(
    client, auth_payload, db, fake_greenhouse
):
    # NB: the session DB is shared, so assert on *this* recipient rather than
    # global counts (process_due scans every user's alerts).
    email = "ja-deliver@example.com"
    jwt, _ = _register(client, auth_payload, email)
    headers = _headers(jwt)
    client.post(
        "/api/job-alerts/",
        headers=headers,
        json={"name": "Remote roles", "criteria": {"location": "Remote"}},
    )

    # Ingest matching postings *after* the alert exists → they're new.
    _ingest(client, headers, "deliverco", "DeliverCo")

    notifier = RecordingNotifier()
    process_due_job_alerts(db, notifier, datetime.now(tz=timezone.utc))

    mine = [m for (_c, r, m) in notifier.sent if r == email]
    assert len(mine) == 1
    assert "Remote roles" in mine[0]

    # A second pass with no new ingests doesn't re-notify this owner.
    notifier2 = RecordingNotifier()
    process_due_job_alerts(db, notifier2, datetime.now(tz=timezone.utc))
    assert [m for (_c, r, m) in notifier2.sent if r == email] == []


def test_process_skips_alerts_with_notify_off(
    client, auth_payload, db, fake_greenhouse
):
    email = "ja-off@example.com"
    jwt, _ = _register(client, auth_payload, email)
    headers = _headers(jwt)
    client.post(
        "/api/job-alerts/",
        headers=headers,
        json={"name": "Silent", "criteria": {"location": "Remote"}, "notify": False},
    )
    _ingest(client, headers, "silentco", "SilentCo")

    notifier = RecordingNotifier()
    process_due_job_alerts(db, notifier, datetime.now(tz=timezone.utc))
    # The notify-off owner is never messaged.
    assert [m for (_c, r, m) in notifier.sent if r == email] == []
