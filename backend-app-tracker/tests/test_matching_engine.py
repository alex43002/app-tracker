"""Unit tests for the pure matching engine (FEAT-21): keywords, extraction,
scoring, and the SSRF fetch guard. No app/client needed."""

import io
import zipfile

import pytest

from app.matching import keywords, scoring
from app.matching.extract import extract_resume_text, html_to_text
from app.matching.fetch import FetchError, _is_public_host, _validate_url


# --------------------------- keyword / skill extraction ---------------------

def test_extract_skills_canonicalizes_aliases():
    text = "Built APIs in JS and Node.js, deployed on AWS with k8s."
    skills = keywords.extract_skills(text)
    assert "javascript" in skills
    assert "node.js" in skills
    assert "aws" in skills
    assert "kubernetes" in skills  # from the "k8s" alias


def test_extract_skills_respects_word_boundaries():
    # "java" must not be found inside "javascript"; "go" not inside "goals".
    skills = keywords.extract_skills("Strong javascript developer with goals")
    assert "javascript" in skills
    assert "java" not in skills
    assert "go" not in skills


def test_multiword_skill_detected():
    assert "machine learning" in keywords.extract_skills(
        "experience with machine learning pipelines"
    )


def test_extract_keywords_drops_stopwords_and_ranks_by_frequency():
    text = "logistics logistics logistics warehouse warehouse the the the and"
    ranked = dict(keywords.extract_keywords(text))
    assert "logistics" in ranked and "warehouse" in ranked
    assert "the" not in ranked and "and" not in ranked
    assert ranked["logistics"] >= ranked["warehouse"]


def test_profile_does_not_double_count_skill_as_keyword():
    prof = keywords.profile("python python python data data")
    assert "python" in prof.skills
    assert "python" not in prof.keywords


# --------------------------- text extraction --------------------------------

def test_extract_plain_text():
    assert extract_resume_text(b"Hello World", content_type="text/plain") == "Hello World"


def test_extract_docx_reads_paragraph_text():
    ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    document = (
        f'<?xml version="1.0"?>'
        f'<w:document xmlns:w="{ns}"><w:body>'
        f"<w:p><w:r><w:t>Python developer</w:t></w:r></w:p>"
        f"<w:p><w:r><w:t>AWS and Docker</w:t></w:r></w:p>"
        f"</w:body></w:document>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("word/document.xml", document)
    text = extract_resume_text(
        buf.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    assert "Python developer" in text
    assert "AWS and Docker" in text


def test_extract_unreadable_returns_empty_string():
    # Bytes that aren't a valid zip/pdf shouldn't raise.
    assert extract_resume_text(b"\x00\x01\x02", content_type="application/pdf") == ""


def test_html_to_text_strips_tags_and_scripts():
    html = (
        "<html><head><title>Senior Engineer</title>"
        "<style>.x{}</style></head><body>"
        "<script>var x = 1;</script>"
        "<h1>Backend Role</h1><p>We use Python and Postgres.</p>"
        "</body></html>"
    )
    text, title = html_to_text(html)
    assert title == "Senior Engineer"
    assert "Backend Role" in text
    assert "We use Python and Postgres." in text
    assert "var x" not in text  # script stripped
    assert ".x{}" not in text  # style stripped


# --------------------------- scoring ----------------------------------------

def test_perfect_coverage_scores_high():
    jd = "We need Python, Django, and PostgreSQL experience."
    resume = "Python developer using Django and PostgreSQL daily."
    result = scoring.score_match(resume, jd)
    assert result.score >= 90
    assert not result.breakdown.missing_skills


def test_missing_skills_become_gaps():
    jd = "Required: Python, Kubernetes, and AWS."
    resume = "I write Python scripts."
    result = scoring.score_match(resume, jd)
    assert "kubernetes" in result.breakdown.missing_skills
    assert "aws" in result.breakdown.missing_skills
    assert "kubernetes" in result.gaps
    assert result.score < 100


def test_resume_padding_does_not_inflate_score():
    # Skills the job never asks for shouldn't raise the score.
    jd = "Looking for a Python developer."
    lean = scoring.score_match("Python developer", jd).score
    padded = scoring.score_match(
        "Python developer who also knows Rust, Scala, Kotlin, and Swift", jd
    ).score
    assert padded == lean


def test_score_falls_back_to_keywords_when_no_skills():
    jd = "Seeking a phlebotomist for venipuncture and specimen collection."
    strong = scoring.score_match(
        "Certified phlebotomist skilled in venipuncture and specimen collection", jd
    ).score
    weak = scoring.score_match("Barista with latte art", jd).score
    assert strong > weak


# --------------------------- SSRF fetch guard -------------------------------

def test_validate_url_rejects_non_http_scheme():
    with pytest.raises(FetchError):
        _validate_url("ftp://example.com/file")


def test_validate_url_rejects_loopback_and_private(monkeypatch):
    # Force resolution to a private/loopback address.
    assert _is_public_host("localhost") is False
    monkeypatch.setattr(
        "app.matching.fetch.socket.getaddrinfo",
        lambda *a, **k: [(2, 1, 6, "", ("10.0.0.5", 0))],
    )
    assert _is_public_host("internal.example") is False
    with pytest.raises(FetchError):
        _validate_url("http://internal.example/jobs")


def test_validate_url_allows_public(monkeypatch):
    monkeypatch.setattr(
        "app.matching.fetch.socket.getaddrinfo",
        lambda *a, **k: [(2, 1, 6, "", ("93.184.216.34", 0))],
    )
    assert _is_public_host("example.com") is True
    assert _validate_url("https://example.com/jobs") == "https://example.com/jobs"
