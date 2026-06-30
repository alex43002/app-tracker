"""Unit tests for friendlier board-token discovery (FEAT-23)."""

import pytest

from app.discovery import boards


@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://boards.greenhouse.io/stripe", ("greenhouse", "stripe")),
        ("https://boards.greenhouse.io/stripe/jobs/123", ("greenhouse", "stripe")),
        ("boards.greenhouse.io/airbnb", ("greenhouse", "airbnb")),
        (
            "https://boards.greenhouse.io/embed/job_board?for=lyft",
            ("greenhouse", "lyft"),
        ),
        (
            "https://job-boards.greenhouse.io/figma",
            ("greenhouse", "figma"),
        ),
        (
            "https://boards-api.greenhouse.io/v1/boards/coinbase/jobs",
            ("greenhouse", "coinbase"),
        ),
        ("https://jobs.lever.co/plaid", ("lever", "plaid")),
        ("https://jobs.lever.co/plaid/some-posting-id", ("lever", "plaid")),
        (
            "https://api.lever.co/v0/postings/netflix?mode=json",
            ("lever", "netflix"),
        ),
    ],
)
def test_extract_board(url, expected):
    assert boards.extract_board(url) == expected


@pytest.mark.parametrize(
    "url",
    [
        "",
        None,
        "https://example.com/careers",
        "https://www.google.com",
        "not a url",
    ],
)
def test_extract_board_rejects_unknown(url):
    assert boards.extract_board(url) is None


def test_search_companies_empty_returns_directory_head():
    out = boards.search_companies(None, limit=5)
    assert len(out) == 5
    assert all({"name", "source", "boardToken"} <= set(c) for c in out)


def test_search_companies_substring_case_insensitive():
    out = boards.search_companies("stri")
    names = {c["name"] for c in out}
    assert "Stripe" in names


def test_search_companies_respects_limit():
    assert len(boards.search_companies(None, limit=2)) == 2
