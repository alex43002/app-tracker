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
