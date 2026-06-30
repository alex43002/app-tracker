"""Unit tests for the discovery engine (FEAT-22): normalization + connectors.
Connectors are exercised end-to-end with a fake JSON fetcher (no network)."""

import pytest

from app.discovery import connectors
from app.discovery.connectors import ConnectorError, fetch_source, valid_token
from app.discovery.normalize import (
    normalize_employment_type,
    normalize_location,
    parse_salary,
)

GREENHOUSE_FIXTURE = {
    "jobs": [
        {
            "id": 111,
            "title": "Backend Engineer",
            "absolute_url": "https://boards.greenhouse.io/acme/jobs/111",
            "updated_at": "2026-06-01T12:00:00Z",
            "location": {"name": "Remote, US"},
            # Greenhouse double-encodes HTML entities in `content`.
            "content": "&lt;p&gt;We use Python and AWS. Salary $120,000 - $150,000&lt;/p&gt;",
        }
    ]
}

LEVER_FIXTURE = [
    {
        "id": "abc",
        "text": "Frontend Engineer",
        "hostedUrl": "https://jobs.lever.co/acme/abc",
        "categories": {"location": "New York", "commitment": "Full-time"},
        "descriptionPlain": "React and TypeScript. Compensation 100k-130k.",
        "createdAt": 1717200000000,
    }
]


# --------------------------- normalization ---------------------------------

@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Full-time", "full-time"),
        ("FULL TIME", "full-time"),
        ("Contractor", "contract"),
        ("Intern", "internship"),
        ("Full-time (Remote)", "full-time"),
        ("nonsense", None),
        (None, None),
    ],
)
def test_normalize_employment_type(raw, expected):
    assert normalize_employment_type(raw) == expected


def test_normalize_location():
    assert normalize_location("  New   York ") == "New York"
    assert normalize_location("") is None


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Salary $120,000 - $150,000", (120000, 150000)),
        ("Pay 100k-130k", (100000, 130000)),
        ("$95,000 annually", (95000, 95000)),
        ("No numbers here", (None, None)),
        ("Founded in 2020, team of 50", (None, None)),  # too small to be salary
    ],
)
def test_parse_salary(text, expected):
    assert parse_salary(text) == expected


# --------------------------- connectors ------------------------------------

def test_valid_token():
    assert valid_token("acme-co")
    assert not valid_token("../etc")
    assert not valid_token("a b")
    assert not valid_token("")


def test_greenhouse_connector_normalizes(monkeypatch):
    monkeypatch.setattr(connectors, "_get_json", lambda url: GREENHOUSE_FIXTURE)
    jobs = fetch_source("greenhouse", "acme", "Acme Inc")
    assert len(jobs) == 1
    job = jobs[0]
    assert job["source"] == "greenhouse"
    assert job["sourceId"] == "111"
    assert job["company"] == "Acme Inc"
    assert job["title"] == "Backend Engineer"
    assert job["location"] == "Remote, US"
    assert "Python and AWS" in job["description"]
    assert "<p>" not in job["description"]  # HTML stripped
    assert (job["salaryMin"], job["salaryMax"]) == (120000, 150000)
    assert job["postedAt"] is not None


def test_lever_connector_normalizes(monkeypatch):
    monkeypatch.setattr(connectors, "_get_json", lambda url: LEVER_FIXTURE)
    jobs = fetch_source("lever", "acme")
    assert len(jobs) == 1
    job = jobs[0]
    assert job["source"] == "lever"
    assert job["sourceId"] == "abc"
    assert job["company"] == "acme"  # defaults to token when no display name
    assert job["employmentType"] == "full-time"
    assert job["location"] == "New York"
    assert (job["salaryMin"], job["salaryMax"]) == (100000, 130000)
    assert job["postedAt"] is not None


def test_fetch_source_rejects_unknown_source():
    with pytest.raises(ConnectorError):
        fetch_source("workday", "acme")


def test_fetch_source_rejects_bad_token():
    with pytest.raises(ConnectorError):
        fetch_source("greenhouse", "../secrets")
