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

ASHBY_FIXTURE = {
    "name": "Acme",
    "jobs": [
        {
            "id": "ash-1",
            "title": "Platform Engineer",
            "location": "San Francisco",
            "isRemote": True,
            "employmentType": "FullTime",
            "jobUrl": "https://jobs.ashbyhq.com/acme/ash-1",
            "descriptionPlain": "Go and Kubernetes. Salary $140,000 - $170,000.",
            "publishedAt": "2026-06-10T09:00:00Z",
        }
    ],
}

RECRUITEE_FIXTURE = {
    "offers": [
        {
            "id": 42,
            "title": "Product Designer",
            "location": "Amsterdam, NL",
            "remote": False,
            "employment_type_code": "parttime",
            "careers_url": "https://acme.recruitee.com/o/product-designer",
            "description": "<p>Figma and design systems. Pay 60k-80k.</p>",
            "requirements": "<p>3 years experience.</p>",
            "published_at": "2026-06-12T08:00:00Z",
        }
    ]
}


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


def test_ashby_connector_normalizes(monkeypatch):
    monkeypatch.setattr(connectors, "_get_json", lambda url: ASHBY_FIXTURE)
    jobs = fetch_source("ashby", "acme")
    assert len(jobs) == 1
    job = jobs[0]
    assert job["source"] == "ashby"
    assert job["sourceId"] == "ash-1"
    assert job["company"] == "Acme"  # falls back to the board's name field
    assert job["title"] == "Platform Engineer"
    assert job["employmentType"] == "full-time"
    # isRemote folds into the location so the location/work filters stay aligned.
    assert "Remote" in job["location"]
    assert (job["salaryMin"], job["salaryMax"]) == (140000, 170000)
    assert job["postedAt"] is not None


def test_recruitee_connector_normalizes(monkeypatch):
    monkeypatch.setattr(connectors, "_get_json", lambda url: RECRUITEE_FIXTURE)
    jobs = fetch_source("recruitee", "acme", "Acme Inc")
    assert len(jobs) == 1
    job = jobs[0]
    assert job["source"] == "recruitee"
    assert job["sourceId"] == "42"
    assert job["company"] == "Acme Inc"
    assert job["title"] == "Product Designer"
    assert job["employmentType"] == "part-time"
    assert job["location"] == "Amsterdam, NL"
    assert "<p>" not in job["description"]  # HTML stripped
    assert "Figma" in job["description"]
    assert (job["salaryMin"], job["salaryMax"]) == (60000, 80000)


def test_supported_sources_includes_new_connectors():
    from app.discovery.connectors import SUPPORTED_SOURCES

    assert {"greenhouse", "lever", "ashby", "recruitee"} <= set(SUPPORTED_SOURCES)


def test_fetch_source_rejects_unknown_source():
    with pytest.raises(ConnectorError):
        fetch_source("workday", "acme")


def test_fetch_source_rejects_bad_token():
    with pytest.raises(ConnectorError):
        fetch_source("greenhouse", "../secrets")
