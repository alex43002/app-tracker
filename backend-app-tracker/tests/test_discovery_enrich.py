"""Unit tests for discovery enrichment (FEAT-22): eligibility, quality, dedupe."""

import pytest

from app.discovery import enrich


@pytest.mark.parametrize(
    "title,description,expected",
    [
        ("Senior Backend Engineer", "", "senior"),
        ("Staff Engineer", "", "lead"),
        ("Software Engineer Intern", "", "entry"),
        ("Mid-level Developer", "", "mid"),
        ("Software Engineer", "We require 7+ years of experience", "senior"),
        ("Software Engineer", "3-5 years experience preferred", "mid"),
        ("Software Engineer", "1-2 years experience", "entry"),
        ("Software Engineer", "great place to work", None),
    ],
)
def test_experience_level(title, description, expected):
    assert enrich.experience_level(title, description) == expected


@pytest.mark.parametrize(
    "location,description,expected",
    [
        ("Remote, US", "", "remote"),
        ("Hybrid - New York", "", "hybrid"),
        ("San Francisco, CA (On-site)", "", "onsite"),
        ("New York", "This is a fully remote role", "remote"),
        ("New York", "Hybrid schedule, 3 days in office", "hybrid"),
        # "remote" mentioned only incidentally → not enough to classify.
        ("New York", "You will manage remote teams across regions", None),
        ("New York", "", None),
    ],
)
def test_work_arrangement(location, description, expected):
    assert enrich.work_arrangement(location, description) == expected


@pytest.mark.parametrize(
    "description,expected",
    [
        ("Bachelor's degree in CS required", True),
        ("MBA preferred", True),
        ("B.S. in Engineering", True),
        ("No formal education required", False),
        ("", False),
    ],
)
def test_requires_degree(description, expected):
    assert enrich.requires_degree(description) is expected


def test_quality_flags_and_score():
    good = {
        "title": "Backend Engineer",
        "description": "x" * 400,
        "location": "Remote",
        "salaryMin": 120000,
        "salaryMax": 150000,
    }
    assert enrich.quality_flags(good) == []
    assert enrich.quality_score([]) == 100

    bad = {
        "title": "URGENT!!! work from home!! earn $$$",
        "description": "short",
        "location": None,
        "salaryMin": None,
        "salaryMax": None,
    }
    flags = enrich.quality_flags(bad)
    assert "no_salary" in flags
    assert "thin_description" in flags
    assert "no_location" in flags
    assert "spammy_title" in flags
    assert enrich.quality_score(flags) < 50


def test_underpaid_flag():
    flags = enrich.quality_flags(
        {
            "title": "Helper",
            "description": "x" * 400,
            "location": "Remote",
            "salaryMin": 20000,
            "salaryMax": 25000,
        }
    )
    assert "underpaid" in flags


@pytest.mark.parametrize(
    "description,expected",
    [
        ("We offer visa sponsorship for this role", True),
        ("H-1B sponsorship available", True),
        ("No sponsorship available for this position", False),
        ("Must be authorized to work in the US", False),
        ("Great team, competitive pay", None),
    ],
)
def test_sponsorship_available(description, expected):
    assert enrich.sponsorship_available(description) is expected


def test_sponsorship_no_wins_over_yes():
    text = "We normally offer visa sponsorship, but no sponsorship for this role"
    assert enrich.sponsorship_available(text) is False


@pytest.mark.parametrize(
    "description,expected",
    [
        ("Active security clearance required", True),
        ("Must be a US citizen", True),
        ("Open to all applicants", False),
    ],
)
def test_clearance_required(description, expected):
    assert enrich.clearance_required(description) is expected


@pytest.mark.parametrize(
    "title,description,expected",
    [
        ("Software Engineer Intern", "", "internship"),
        ("Backend Engineer (Contract)", "", "contract"),
        ("Customer Support", "This is a part-time role", "part-time"),
        ("Warehouse Associate", "Seasonal / temporary position", "temporary"),
        ("Backend Engineer", "Full-time, permanent role", "full-time"),
        # No signal → None (the inference layer; enrich() defaults separately).
        ("Backend Engineer", "Join our internal platform team", None),
    ],
)
def test_infer_employment_type(title, description, expected):
    from app.discovery.normalize import infer_employment_type

    assert infer_employment_type(title, description) == expected


def test_enrich_defaults_employment_type_to_full_time():
    """BUG-24: postings with no structured/inferable type default to full-time."""
    out = enrich.enrich(
        {
            "title": "Backend Engineer",
            "description": "Join our internal platform team. " + "x" * 400,
            "company": "Acme",
            "location": "Remote",
            "employmentType": None,
        }
    )
    assert out["employmentType"] == "full-time"


def test_enrich_keeps_structured_employment_type():
    """A connector-provided (e.g. Lever commitment) value is preserved."""
    out = enrich.enrich(
        {
            "title": "Backend Engineer",
            "description": "x" * 400,
            "company": "Acme",
            "location": "Remote",
            "employmentType": "contract",
        }
    )
    assert out["employmentType"] == "contract"


def test_enrich_infers_employment_type_from_text():
    out = enrich.enrich(
        {
            "title": "Software Engineering Intern",
            "description": "x" * 400,
            "company": "Acme",
            "location": "Remote",
            "employmentType": None,
        }
    )
    assert out["employmentType"] == "internship"


def test_dedupe_key_is_stable_and_company_aware():
    a = enrich.dedupe_key("Acme Inc", "Backend Engineer", "Remote, US")
    b = enrich.dedupe_key("acme   inc", "backend  engineer", "remote, us")
    assert a == b  # normalization makes these identical
    c = enrich.dedupe_key("OtherCo", "Backend Engineer", "Remote, US")
    assert a != c  # different company → different role


def test_enrich_bundles_all_fields():
    out = enrich.enrich(
        {
            "title": "Senior Engineer",
            "description": "Bachelor's degree required. " + "x" * 400,
            "location": "Remote",
            "company": "Acme",
            "salaryMin": 150000,
            "salaryMax": 180000,
        }
    )
    assert out["experienceLevel"] == "senior"
    assert out["requiresDegree"] is True
    assert out["qualityFlags"] == []
    assert out["qualityScore"] == 100
    assert out["dedupeKey"]
