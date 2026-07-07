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


def test_expanded_taxonomy_covers_more_domains():
    text = "Built React Native apps, ran a Kafka pipeline, used Snowflake and Terraform."
    skills = set(keywords.extract_skills(text))
    assert {"react native", "kafka", "snowflake", "terraform"} <= skills


@pytest.mark.parametrize(
    "word,expected",
    [
        ("managing", "manag"),
        ("managed", "manag"),
        ("management", "manag"),
        ("manager", "manag"),
        ("systems", "system"),
        ("analytics", "analytic"),
        # Skill tokens with punctuation and very short words are left alone.
        ("c++", "c++"),
        ("node.js", "node.js"),
        ("ci/cd", "ci/cd"),
        ("api", "api"),
    ],
)
def test_stem_folds_inflections_but_spares_skills(word, expected):
    assert keywords.stem(word) == expected


def test_vocabulary_includes_stemmed_unigrams_and_bigrams():
    vocab = keywords.vocabulary("Managing distributed logistics operations daily")
    assert "manag" in vocab
    assert "logistic" in vocab
    assert "distribut logistic" in vocab


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


def test_html_prefers_main_and_drops_chrome():
    """FEAT-31: with a <main> region, only its content is returned; nav/footer/
    aside/cookie chrome around it is stripped, not scored."""
    html = (
        "<html><head><title>Network Ops</title></head><body>"
        "<header role='banner'><nav>Careers About Login</nav></header>"
        "<div class='cookie-banner'>We use cookies. Accept</div>"
        "<main><h1>Network Ops</h1>"
        "<p>Experience with LAN switching and BGP.</p></main>"
        "<aside class='related-jobs'>Similar jobs: Android Developer</aside>"
        "<footer>Alphabet Inc. Melbourne VIC. All rights reserved.</footer>"
        "</body></html>"
    )
    text, title = html_to_text(html)
    assert title == "Network Ops"
    assert "LAN switching" in text and "BGP" in text
    for junk in ("Careers", "cookies", "Android", "Alphabet", "Melbourne", "reserved"):
        assert junk not in text, f"chrome leaked: {junk}"


def test_html_drops_chrome_without_main():
    """No <main>: chrome *tags* (nav/footer/aside) and chrome-*class* containers
    are still dropped, keeping only the real body content."""
    html = (
        "<body><nav>Home Careers Login</nav>"
        "<div class='job-content'><h1>Backend Role</h1>"
        "<p>We use Python and Postgres.</p></div>"
        "<div class='cookie'>Accept cookies</div>"
        "<footer>Alphabet Inc</footer></body>"
    )
    text, _ = html_to_text(html)
    assert "Python and Postgres" in text
    for junk in ("Careers", "Accept cookies", "Alphabet"):
        assert junk not in text, f"chrome leaked: {junk}"


# --------------------------- noise-phrase filter (FEAT-31) ------------------

@pytest.mark.parametrize(
    "phrase",
    [
        "person_outline",          # Material-icon ligature
        "arrow_forward",
        "alphabet inc",            # company/legal token
        "criminal histories",      # EEO legal boilerplate
        "melbourne vic",           # location chip (trailing region code)
        "san jose ca",
        "careers careers skip",    # repeated token
    ],
)
def test_is_noise_phrase_rejects_scraped_chrome(phrase):
    assert keywords.is_noise_phrase(phrase) is True


@pytest.mark.parametrize(
    "phrase",
    [
        "machine learning",
        "specimen collection",
        "patient assessment",
        "lan switching",
        "financial reporting",
    ],
)
def test_is_noise_phrase_keeps_real_terms(phrase):
    assert keywords.is_noise_phrase(phrase) is False


# --------------------------- scoring ----------------------------------------

def test_perfect_coverage_scores_high():
    jd = "We need Python, Django, and PostgreSQL experience."
    resume = "Python developer using Django and PostgreSQL daily."
    result = scoring.score_match(resume, jd)
    assert result.score >= 85
    strong = {m.term for m in result.strengths if m.status == "strong"}
    assert {"python", "django", "postgresql"} <= strong
    assert not result.gaps  # nothing the posting asked for is missing


def test_missing_skills_become_gaps():
    jd = "Required: Python, Kubernetes, and AWS."
    resume = "I write Python scripts."
    result = scoring.score_match(resume, jd)
    gaps = {m.term for m in result.gaps}
    assert "kubernetes" in gaps
    assert "aws" in gaps
    assert result.score < 100
    # Concept signal is available (Python/K8s/AWS are curated), so not N/A.
    assert result.coverage.concept is not None


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
