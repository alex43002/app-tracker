"""Domain-agnostic matching engine (FEAT-21 redesign).

These tests deliberately span unrelated fields — software, networking, nursing,
accounting, culinary — to prove the engine does not depend on any one domain's
vocabulary, and they pin the correctness rules the previous engine violated
(no fake 100% skill coverage, honest N/A, section weighting, evidence).
"""

from app.matching import scoring
from app.matching.extract import html_to_text
from app.matching.sections import (
    split_sections,
    KIND_BOILERPLATE,
    KIND_REQUIRED,
    KIND_PREFERRED,
)


NURSING_JOB = """
Requirements:
Active RN license and BLS certification.
Experience with patient assessment, medication administration, and IV therapy.
Strong knowledge of electronic health records and HIPAA compliance.
Responsibilities:
Provide direct patient care, monitor vital signs, and administer medications.
Preferred qualifications:
ACLS certification and telemetry experience.
Benefits: 401k and health insurance. We are an equal opportunity employer.
"""
NURSING_RESUME = """
Registered Nurse, 4 years medical-surgical. Patient assessment, medication administration,
IV therapy, vital signs monitoring. Charting in Epic EHR. HIPAA compliant. BLS certification.
"""

NETWORKING_JOB = """
Minimum qualifications:
Experience with LAN switching and TCP/IP.
Experience with core routing protocols such as BGP, OSPF, ISIS.
Preferred qualifications:
MPLS VPN, VXLAN, and Cisco or Juniper platforms.
Benefits: generous benefits. Google is an equal opportunity employer.
"""
NETWORKING_RESUME = """
Network technician. LAN switching, VLAN assignments, TCP/IP troubleshooting.
LLDP neighbor checks and duplex checks. Cisco IOS familiarity.
"""


# --------------------------- honesty rules ----------------------------------

def test_no_concepts_reports_na_not_fake_full():
    """A field the taxonomy doesn't know must show concept coverage = N/A, and
    still produce a real, non-100 score from the generic phrase path."""
    job = """
    Responsibilities:
    Prepare sauces, plate desserts, and manage the line during dinner service.
    Requirements:
    Experience with knife skills and food safety.
    """
    resume = "Line cook. Knife skills, sauce preparation, and plating desserts during service."
    result = scoring.score_match(resume, job)
    assert result.coverage.concept is None  # honest N/A, never 100%
    assert result.skill_signal_available is False
    assert 0 < result.score < 100
    # It matched on salient phrases, so there are real strengths.
    assert any(m.status != "missing" for m in result.strengths)


def test_pure_boilerplate_posting_is_low_confidence_not_100():
    job = "About us:\nWe are an equal opportunity employer offering great benefits and perks."
    resume = "Python developer with Django."
    result = scoring.score_match(resume, job)
    assert result.confidence == "low"
    assert result.coverage.concept is None
    assert result.score < 50  # boilerplate must not manufacture a high score


def test_boilerplate_terms_never_become_gaps_or_strengths():
    result = scoring.score_match(NETWORKING_RESUME, NETWORKING_JOB)
    terms = {m.term for m in result.gaps} | {m.term for m in result.strengths}
    for noise in ("benefits", "google", "equal", "opportunity", "employer"):
        assert not any(noise in t for t in terms), f"boilerplate leaked: {noise}"


# --------------------------- domain generality ------------------------------

def test_networking_posting_detects_protocols_as_concepts():
    """The exact failure that motivated the redesign: a networking JD must yield
    recognized concepts, not zero skills scored on raw overlap."""
    result = scoring.score_match(NETWORKING_RESUME, NETWORKING_JOB)
    assert result.skill_signal_available is True
    strong = {m.term for m in result.strengths if m.status in ("strong", "partial")}
    assert {"lan switching", "tcp/ip"} & strong
    gaps = {m.term for m in result.gaps}
    assert {"bgp", "ospf", "isis"} & gaps
    assert "Network & infrastructure" in result.role_families


def test_nursing_matches_across_synonyms_with_evidence():
    result = scoring.score_match(NURSING_RESUME, NURSING_JOB)
    assert result.role_families == ["Healthcare"]  # not mislabelled as IT ops
    strong = {m.term for m in result.strengths if m.status == "strong"}
    assert "emr" in strong  # "electronic health records" ↔ "Epic EHR"
    assert "hipaa" in strong
    # Evidence is attached so the report can show *why* it matched.
    assert any(m.evidence for m in result.strengths)


def test_strong_resume_outscores_unrelated_resume():
    strong = scoring.score_match(NURSING_RESUME, NURSING_JOB).score
    barista = scoring.score_match("Barista skilled in latte art.", NURSING_JOB).score
    assert strong > barista
    assert barista <= 10


def test_role_family_degrades_to_general_when_unknown():
    job = "Responsibilities:\nPrepare sauces and plate desserts during service."
    result = scoring.score_match("Line cook.", job)
    assert result.role_families == ["General"]


# --------------------------- section weighting ------------------------------

def test_required_gap_hurts_more_than_preferred_gap():
    resume = "I deploy applications to production."
    req_job = "Minimum qualifications:\nExpert in Kubernetes.\nResponsibilities:\nDeploy applications."
    pref_job = "Preferred qualifications:\nExpert in Kubernetes.\nResponsibilities:\nDeploy applications."
    req_score = scoring.score_match(resume, req_job).score
    pref_score = scoring.score_match(resume, pref_job).score
    assert req_score < pref_score


def test_sections_split_required_and_preferred():
    kinds = {s.kind for s in split_sections(NETWORKING_JOB)}
    assert KIND_REQUIRED in kinds
    assert KIND_PREFERRED in kinds


def test_confidence_scales_with_extracted_signal():
    rich = scoring.score_match(NETWORKING_RESUME, NETWORKING_JOB)
    assert rich.confidence in ("high", "medium")
    thin = scoring.score_match("x", "About us:\nGreat benefits.")
    assert thin.confidence == "low"


# --------------------------- scrape de-contamination (FEAT-31) --------------

# A realistic scraped Network Operations posting: page chrome (nav/banner,
# cookie bar, footer) plus a "Similar jobs" rail wrapping a real <main> body —
# exactly the shape that used to leak `android`, `machine learning`,
# `melbourne vic`, `alphabet inc`, `person_outline …` into the requirement list.
SCRAPED_NETOPS_HTML = """
<html><head><title>Network Operations Engineer</title></head><body>
<header role="banner"><nav><ul>
  <li>Careers</li><li>About</li><li>Login</li></ul></nav></header>
<div class="cookie-banner">We use cookies. Accept</div>
<main>
  <h1>Network Operations Engineer</h1>
  <h2>Minimum qualifications</h2>
  <ul><li>Experience with LAN switching and TCP/IP.</li>
      <li>Core routing protocols such as BGP and OSPF.</li></ul>
  <h2>Responsibilities</h2>
  <ul><li>Monitor network health and respond to incidents.</li></ul>
  <h2>Preferred qualifications</h2>
  <ul><li>MPLS VPN and Cisco platforms.</li></ul>
</main>
<aside class="related-jobs"><h2>Similar jobs</h2><ul>
  <li>Android Developer - Machine Learning</li>
  <li>Enterprise AI - San Jose</li>
  <li>person_outline Your Career</li></ul></aside>
<footer><p>Alphabet Inc. Melbourne VIC. All rights reserved.</p></footer>
</body></html>
"""
# Unambiguous junk substrings (avoid short ones like "inc" that live inside
# legitimate terms such as "incidents").
_NETOPS_JUNK = (
    "android", "machine learning", "melbourne", "alphabet",
    "person_outline", "enterprise ai", "san jose", "careers", "cookie",
)


def test_scraped_chrome_stays_out_of_gaps_and_keywords():
    text, _ = html_to_text(SCRAPED_NETOPS_HTML)
    resume = "Network technician. LAN switching, VLAN, TCP/IP troubleshooting. Cisco IOS."
    result = scoring.score_match(resume, text)

    terms = {m.term.lower() for m in result.gaps} | {m.term.lower() for m in result.strengths}
    terms |= {k.lower() for k in result.job_profile.keywords}
    for junk in _NETOPS_JUNK:
        assert not any(junk in t for t in terms), f"scraped chrome leaked: {junk}"
    # The real <main> requirements survived and are scored.
    strong = {m.term for m in result.strengths if m.status in ("strong", "partial")}
    assert {"lan switching", "tcp/ip"} & strong
    assert "Network & infrastructure" in result.role_families


def test_network_ops_regression_sane_score_band():
    """The motivating case: with junk gone, a partial-fit résumé lands in a
    sane band instead of collapsing (was 26/100 from contamination)."""
    text, _ = html_to_text(SCRAPED_NETOPS_HTML)
    resume = "Network technician. LAN switching, VLAN, TCP/IP troubleshooting. Cisco IOS."
    result = scoring.score_match(resume, text)
    # Real gaps only (bgp/ospf/mpls), so a genuine partial fit isn't tanked.
    assert 25 <= result.score <= 80
    assert result.contamination == "low"  # clean extraction → not approximate
    assert all(g.term.lower() not in _NETOPS_JUNK for g in result.gaps)


def test_similar_jobs_block_is_boilerplate_boundary():
    """A 'Similar jobs' header makes everything after it boilerplate, so a
    related-jobs rail in plain text never becomes a requirement."""
    job = (
        "Minimum qualifications:\nExperience with Python and Django.\n"
        "Similar jobs:\nAndroid Developer\nMachine Learning Engineer\n"
    )
    kinds = [s.kind for s in split_sections(job)]
    assert KIND_BOILERPLATE in kinds
    result = scoring.score_match("Python developer with Django.", job)
    gap_terms = {m.term.lower() for m in result.gaps}
    assert not any(j in " ".join(gap_terms) for j in ("android", "machine learning"))


def test_high_contamination_caps_confidence_and_flags_approximate():
    noisy = (
        "Requirements:\nPython developer needed.\n"
        "melbourne vic sydney nsw brisbane qld\n"
        "alphabet inc google llc\n"
        "person_outline arrow_forward location_on\n"
    )
    result = scoring.score_match("Python.", noisy)
    assert result.contamination == "high"
    assert result.confidence != "high"
    assert "approximate" in result.confidence_reason


def test_clean_posting_reports_low_contamination():
    result = scoring.score_match(NURSING_RESUME, NURSING_JOB)
    assert result.contamination == "low"


def test_all_miss_preferred_list_does_not_tank_score():
    """A long, entirely-unmatched preferred list weighs less than required, so
    it can't collapse an otherwise strong required/responsibility fit."""
    resume = "Python developer using Django. I build REST APIs and deploy services daily."
    job = (
        "Minimum qualifications:\nPython and Django.\n"
        "Responsibilities:\nBuild REST APIs and deploy services.\n"
        "Preferred qualifications:\nKubernetes, Terraform, Kafka, Snowflake, and Rust.\n"
    )
    result = scoring.score_match(resume, job)
    assert result.coverage.preferred == 0.0  # nothing preferred matched
    assert result.score >= 75  # required + responsibilities still carry it


# --------------------------- expanded taxonomy (FEAT-31) --------------------

def test_new_taxonomy_detects_cybersecurity_family():
    job = (
        "Requirements:\nExperience with SIEM, SOAR, EDR and IAM.\n"
        "Responsibilities:\nLead incident response and threat hunting.\n"
        "Preferred:\nZero trust and ISO 27001.\n"
    )
    resume = "SOC analyst with SIEM, EDR, incident response and vulnerability management."
    result = scoring.score_match(resume, job)
    assert result.role_families == ["Security"]
    strong = {m.term for m in result.strengths if m.status in ("strong", "partial")}
    assert {"edr", "siem", "incident response"} & strong


def test_new_taxonomy_detects_finance_and_product_and_sales():
    finance = scoring.score_match(
        "Accountant experienced in FP&A, reconciliation, general ledger.",
        "Requirements:\nFP&A, financial reporting, account reconciliation, SOX.",
    )
    assert finance.role_families == ["Finance"]

    product = scoring.score_match(
        "Product manager: roadmap ownership, backlog grooming, OKRs.",
        "Requirements:\nOwn the product roadmap, manage the backlog, define OKRs.",
    )
    assert product.role_families == ["Product & project"]

    sales = scoring.score_match(
        "Account executive: CRM, sales pipeline, quota attainment, cold outreach.",
        "Requirements:\nManage the sales pipeline, hit quota, prospecting. CRM.",
    )
    assert sales.role_families == ["Sales"]
