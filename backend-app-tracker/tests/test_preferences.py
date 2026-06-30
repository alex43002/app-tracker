"""API tests for user company preferences (FEAT-22) and their effect on the
discovery listing."""

import pytest

from app.discovery import connectors

# Two companies, each with one posting; used to verify hide/prefer behaviour.
GREENHOUSE = {
    "jobs": [
        {
            "id": 1,
            "title": "Backend Engineer",
            "absolute_url": "https://boards.greenhouse.io/x/jobs/1",
            "updated_at": "2026-06-10T12:00:00Z",
            "location": {"name": "Remote"},
            "content": "Python role. " * 40,
        }
    ]
}


def _headers(jwt):
    return {"Authorization": f"Bearer {jwt}"}


def _register(client, auth_payload, email):
    res = client.post("/api/auth/register", json={**auth_payload, "email": email})
    assert res.status_code == 200
    return res.json()["data"]["jwt"]


def test_preferences_default_then_update(client, auth_payload):
    jwt = _register(client, auth_payload, "prefs-crud@example.com")
    headers = _headers(jwt)

    default = client.get("/api/preferences/", headers=headers).json()["data"]
    assert default == {
        "preferredCompanies": [],
        "hiddenCompanies": [],
        "hiddenEmploymentTypes": [],
    }

    updated = client.put(
        "/api/preferences/",
        headers=headers,
        json={"hiddenCompanies": ["Acme", "Acme", " Acme ", "BadCo"]},
    ).json()["data"]
    # De-duped (case-insensitive) and trimmed; other lists untouched.
    assert updated["hiddenCompanies"] == ["Acme", "BadCo"]
    assert updated["preferredCompanies"] == []

    # Partial update leaves hiddenCompanies in place.
    again = client.put(
        "/api/preferences/",
        headers=headers,
        json={"preferredCompanies": ["DreamCo"]},
    ).json()["data"]
    assert again["hiddenCompanies"] == ["Acme", "BadCo"]
    assert again["preferredCompanies"] == ["DreamCo"]


def test_preferences_are_per_user(client, auth_payload):
    a = _register(client, auth_payload, "prefs-a@example.com")
    b = _register(client, auth_payload, "prefs-b@example.com")
    client.put(
        "/api/preferences/", headers=_headers(a), json={"hiddenCompanies": ["Secret"]}
    )
    b_prefs = client.get("/api/preferences/", headers=_headers(b)).json()["data"]
    assert b_prefs["hiddenCompanies"] == []


def test_preferences_require_auth(client):
    assert client.get("/api/preferences/").status_code == 401


@pytest.fixture
def fake_greenhouse(monkeypatch):
    monkeypatch.setattr(connectors, "_get_json", lambda url: GREENHOUSE)


def test_hidden_company_excluded_when_preferences_applied(
    client, auth_payload, fake_greenhouse
):
    jwt = _register(client, auth_payload, "prefs-hide@example.com")
    headers = _headers(jwt)
    # Ingest under two distinct companies (same fixture, different display names).
    client.post(
        "/api/discovery/ingest",
        headers=headers,
        json={"source": "greenhouse", "boardToken": "keepco", "companyName": "KeepCo"},
    )
    client.post(
        "/api/discovery/ingest",
        headers=headers,
        json={"source": "greenhouse", "boardToken": "hideco", "companyName": "HideCo"},
    )
    client.put(
        "/api/preferences/", headers=headers, json={"hiddenCompanies": ["HideCo"]}
    )

    # Without preferences, both companies show.
    both = client.get(
        "/api/discovery/jobs?q=Backend", headers=headers
    ).json()["data"]
    companies = {i["company"] for i in both["items"]}
    assert {"KeepCo", "HideCo"} <= companies

    # With preferences applied, HideCo is gone.
    filtered = client.get(
        "/api/discovery/jobs?q=Backend&applyPreferences=true", headers=headers
    ).json()["data"]
    filtered_companies = {i["company"] for i in filtered["items"]}
    assert "HideCo" not in filtered_companies
    assert "KeepCo" in filtered_companies


def test_preferred_only_restricts_to_preferred(client, auth_payload, fake_greenhouse):
    jwt = _register(client, auth_payload, "prefs-only@example.com")
    headers = _headers(jwt)
    client.post(
        "/api/discovery/ingest",
        headers=headers,
        json={"source": "greenhouse", "boardToken": "p1", "companyName": "Pref1"},
    )
    client.post(
        "/api/discovery/ingest",
        headers=headers,
        json={"source": "greenhouse", "boardToken": "p2", "companyName": "Other2"},
    )
    client.put(
        "/api/preferences/", headers=headers, json={"preferredCompanies": ["Pref1"]}
    )

    res = client.get(
        "/api/discovery/jobs?q=Backend&preferredOnly=true", headers=headers
    ).json()["data"]
    assert {i["company"] for i in res["items"]} == {"Pref1"}
