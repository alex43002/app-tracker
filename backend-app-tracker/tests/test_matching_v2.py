"""Domain-agnostic matching engine (FEAT-21 redesign).

These tests deliberately span unrelated fields — software, networking, nursing,
accounting, culinary — to prove the engine does not depend on any one domain's
vocabulary, and they pin the correctness rules the previous engine violated
(no fake 100% skill coverage, honest N/A, section weighting, evidence).
"""

from app.matching import scoring
from app.matching.sections import split_sections, KIND_REQUIRED, KIND_PREFERRED


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
