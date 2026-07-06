"""Concept taxonomy for résumé ↔ job matching (no generative AI).

The original engine only knew a flat software-skills list, so a networking
posting ("LAN switching, BGP, OSPF, VLANs, MOPs…") extracted *zero* skills and
collapsed to raw keyword overlap. This taxonomy fixes that by modelling
**concepts**: a canonical idea (e.g. ``lan switching``) with

* a **category** (``net_l2``, ``net_ops``, ``language`` …) used for role-family
  detection and grouping,
* a **tier** — ``core`` (hands-on, heavily weighted), ``foundational``
  (conceptual, partial credit) or ``advanced`` (preferred/nice-to-have),
* **aliases** — every surface form we accept from *either* side (job or
  résumé), including multi-word phrases and acronyms, and
* **related** concepts, so a résumé that shows an adjacent skill gets partial
  credit instead of a hard miss (e.g. ``lldp neighbor checks`` → partial credit
  toward ``lan switching``).

Detection is deterministic, word-boundary aware, and records the surface phrase
that matched so the report can show *evidence* ("matched because your résumé
says 'lldp neighbor checks'").
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.matching.keywords import SKILL_ALIASES, normalize

# Tiers, ordered by how strongly a match counts.
TIER_CORE = "core"
TIER_FOUNDATIONAL = "foundational"
TIER_ADVANCED = "advanced"


@dataclass(frozen=True)
class Concept:
    id: str  # canonical label shown to users
    category: str
    tier: str
    aliases: tuple[str, ...]
    related: tuple[str, ...] = ()


# ---------------------------------------------------------------------------
# Coarse categories for the pre-existing software skills, so role-family
# detection can tell "software engineering" apart from "networking". Anything
# not listed defaults to ``software``.
# ---------------------------------------------------------------------------
_SOFTWARE_GROUPS: dict[str, tuple[str, ...]] = {
    "language": (
        "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust",
        "ruby", "php", "swift", "kotlin", "scala", "r", "sql", "bash",
        "objective-c", "dart", "elixir", "perl", "matlab", "solidity", "groovy",
    ),
    "frontend": (
        "react", "angular", "vue", "next.js", "html", "css", "tailwind", "redux",
        "svelte", "sass", "jquery", "webpack", "vite", "bootstrap", "material ui",
        "accessibility",
    ),
    "backend": (
        "node.js", "express", "nest.js", "django", "flask", "fastapi", "spring",
        "rails", ".net", "laravel", "graphql", "rest", "grpc", "soap", "websockets",
    ),
    "data_ml": (
        "machine learning", "deep learning", "nlp", "computer vision",
        "data engineering", "data science", "pandas", "numpy", "scikit-learn",
        "tensorflow", "pytorch", "keras", "matplotlib", "spark", "hadoop", "kafka",
        "airflow", "dbt", "etl", "data analysis", "data warehousing",
    ),
    "database": (
        "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "sqlite",
        "oracle", "sql server", "dynamodb", "cassandra", "snowflake", "bigquery",
        "neo4j",
    ),
    "cloud_devops": (
        "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ansible",
        "helm", "prometheus", "grafana", "ci/cd", "jenkins", "github actions",
        "gitlab ci", "circleci", "lambda", "serverless", "linux", "nginx",
        "kafka streams",
    ),
    "mobile": ("android", "ios", "react native", "flutter", "xamarin"),
    "security": ("penetration testing", "owasp", "siem", "oauth", "jwt", "encryption"),
    "qa": ("selenium", "cypress", "playwright", "jest", "pytest", "junit"),
    "practice": (
        "agile", "scrum", "kanban", "tdd", "microservices", "unit testing",
        "object-oriented programming", "design patterns", "data structures",
        "algorithms", "mvc",
    ),
    "tool": (
        "git", "jira", "confluence", "figma", "excel", "tableau", "power bi",
        "looker", "salesforce", "hubspot",
    ),
    "design": ("ui/ux", "sketch", "photoshop", "illustrator", "wireframing"),
    "business": (
        "seo", "sem", "google analytics", "content marketing", "financial modeling",
        "quickbooks", "gaap", "stakeholder management", "product management",
    ),
    "healthcare": ("hipaa", "emr"),
    "soft": (
        "communication", "leadership", "teamwork", "problem solving",
        "project management", "mentoring",
    ),
}
_CATEGORY_OF_SKILL: dict[str, str] = {
    skill: group for group, skills in _SOFTWARE_GROUPS.items() for skill in skills
}


# ---------------------------------------------------------------------------
# Illustrative *jargon/acronym* concepts for the networking domain. These are
# deliberately limited to unambiguous technical terms (protocols, vendors,
# specific technologies) where a curated normalizer genuinely helps — e.g.
# mapping ``k8s`` → kubernetes or ``ehr`` → the health-records concept. Generic
# operational English ("monitoring", "incident response", "troubleshooting")
# is intentionally NOT modelled here: the generic keyphrase path already matches
# those phrase-to-phrase within a field, and hard-coding them would bleed one
# domain's vocabulary into every other. Extend this list per genuine acronym
# need, not per example.
# ---------------------------------------------------------------------------
_NETWORKING_CONCEPTS: tuple[Concept, ...] = (
    # Layer 1 / physical (specific technologies only)
    Concept("optical transmission", "net_l1", TIER_ADVANCED,
            ("optical transmission", "optical transmission systems", "optical transport",
             "dwdm", "optical link", "optical links", "transceiver", "transceivers",
             "sfp", "qsfp")),
    # Layer 2
    Concept("lan switching", "net_l2", TIER_CORE,
            ("lan switching", "local area network", "l2 switching"),
            related=("vlan", "lldp", "duplex", "mac address table")),
    Concept("vlan", "net_l2", TIER_CORE,
            ("vlan", "vlans", "virtual local area network", "trunk port",
             "access port", "trunking")),
    Concept("lldp", "net_l2", TIER_FOUNDATIONAL,
            ("lldp", "cdp", "link layer discovery")),
    Concept("duplex", "net_l2", TIER_FOUNDATIONAL, ("duplex", "duplex mismatch")),
    Concept("mac address table", "net_l2", TIER_FOUNDATIONAL,
            ("mac address", "mac table", "mac address table")),
    # Layer 3
    Concept("tcp/ip", "net_l3", TIER_FOUNDATIONAL,
            ("tcp/ip", "tcp ip", "tcpip")),
    Concept("ip addressing", "net_l3", TIER_FOUNDATIONAL,
            ("ip addressing", "subnet", "subnetting", "cidr", "default gateway")),
    Concept("routing protocols", "net_l3", TIER_CORE,
            ("routing protocol", "routing protocols", "core routing",
             "dynamic routing", "static route", "static routes"),
            related=("bgp", "ospf", "isis", "tcp/ip", "ip addressing")),
    Concept("bgp", "net_l3", TIER_ADVANCED, ("bgp", "border gateway protocol")),
    Concept("ospf", "net_l3", TIER_ADVANCED, ("ospf", "open shortest path first")),
    Concept("isis", "net_l3", TIER_ADVANCED,
            ("isis", "is-is", "intermediate system to intermediate system")),
    # Services
    Concept("dns", "net_services", TIER_FOUNDATIONAL, ("dns", "domain name system")),
    Concept("dhcp", "net_services", TIER_FOUNDATIONAL,
            ("dhcp", "dynamic host configuration protocol")),
    Concept("radius", "net_services", TIER_FOUNDATIONAL,
            ("radius", "tacacs", "tacacs+")),
    Concept("ntp", "net_services", TIER_FOUNDATIONAL, ("ntp", "network time protocol")),
    Concept("nat", "net_services", TIER_FOUNDATIONAL,
            ("nat", "network address translation")),
    # Security / tunnels / overlays
    Concept("ipsec", "net_security", TIER_ADVANCED, ("ipsec", "ip sec")),
    Concept("gre", "net_security", TIER_ADVANCED,
            ("gre", "generic routing encapsulation")),
    Concept("mpls vpn", "net_security", TIER_ADVANCED,
            ("mpls", "mpls vpn", "label switching")),
    Concept("vxlan", "net_security", TIER_ADVANCED,
            ("vxlan", "virtual extensible lan", "evpn")),
    # Wireless
    Concept("wi-fi", "net_wireless", TIER_ADVANCED,
            ("wi-fi", "wifi", "wlan", "802.11")),
    # Vendors / platforms
    Concept("cisco", "net_vendor", TIER_CORE,
            ("cisco", "ios-xr", "nx-os", "catalyst", "nexus")),
    Concept("juniper", "net_vendor", TIER_CORE, ("juniper", "junos")),
    Concept("arista", "net_vendor", TIER_CORE, ("arista", "arista eos")),
    Concept("palo alto", "net_vendor", TIER_CORE,
            ("palo alto", "panos", "pan-os", "palo alto networks")),
    # Specific tools (acronym normalizers)
    Concept("packet capture", "net_tool", TIER_FOUNDATIONAL,
            ("packet capture", "wireshark", "tcpdump", "pcap")),
    Concept("bmc tools", "net_tool", TIER_FOUNDATIONAL,
            ("idrac", "ilo", "ipmi", "bmc")),
    # Automation
    Concept("network automation", "net_automation", TIER_ADVANCED,
            ("netmiko", "napalm", "nornir")),
)


# ---------------------------------------------------------------------------
# Curated jargon/acronym concepts for domains the flat skill list covers only
# thinly (FEAT-31). Same discipline as the networking set: only unambiguous
# acronyms/multi-word terms where a normalizer genuinely helps — NOT generic
# operational English. Categories reuse the software groups where the family is
# identical (``security``, ``data_ml``) and introduce ``product``/``sales``/
# ``finance`` for the new families. Aliases are chosen to avoid colliding with
# existing concepts; where they would (e.g. ``oracle``), a distinct surface form
# is used (``oracle financials``).
# ---------------------------------------------------------------------------
_DOMAIN_CONCEPTS: tuple[Concept, ...] = (
    # --- Cybersecurity (family: Security) ---
    Concept("soar", "security", TIER_CORE,
            ("soar", "security orchestration automation")),
    Concept("edr", "security", TIER_CORE,
            ("edr", "xdr", "endpoint detection and response", "endpoint detection")),
    Concept("iam", "security", TIER_CORE,
            ("iam", "identity and access management", "identity access management",
             "privileged access management", "pam")),
    Concept("firewall", "security", TIER_CORE,
            ("firewall", "firewalls", "next-generation firewall", "ngfw")),
    Concept("incident response", "security", TIER_FOUNDATIONAL,
            ("incident response", "incident handling", "csirt")),
    Concept("vulnerability management", "security", TIER_FOUNDATIONAL,
            ("vulnerability management", "vulnerability scanning", "vulnerability assessment")),
    Concept("dlp", "security", TIER_FOUNDATIONAL, ("data loss prevention", "dlp")),
    Concept("soc analyst", "security", TIER_FOUNDATIONAL,
            ("security operations center", "security operations centre", "soc analyst")),
    Concept("nist", "security", TIER_FOUNDATIONAL, ("nist", "nist csf")),
    Concept("threat intelligence", "security", TIER_ADVANCED,
            ("threat intelligence", "threat hunting", "threat intel")),
    Concept("zero trust", "security", TIER_ADVANCED, ("zero trust", "ztna")),
    Concept("iso 27001", "security", TIER_ADVANCED, ("iso 27001", "iso27001")),
    # --- Data engineering (family: Data & ML) ---
    Concept("databricks", "data_ml", TIER_CORE, ("databricks",)),
    Concept("redshift", "data_ml", TIER_CORE, ("redshift", "amazon redshift")),
    Concept("data pipeline", "data_ml", TIER_FOUNDATIONAL,
            ("data pipeline", "data pipelines", "ingestion pipeline")),
    Concept("data modeling", "data_ml", TIER_FOUNDATIONAL,
            ("data modeling", "data modelling", "dimensional modeling", "star schema")),
    Concept("data lake", "data_ml", TIER_FOUNDATIONAL,
            ("data lake", "lakehouse", "delta lake")),
    Concept("data governance", "data_ml", TIER_ADVANCED,
            ("data governance", "data lineage", "data quality")),
    # --- Product / project (family: Product & project) ---
    Concept("product roadmap", "product", TIER_CORE, ("roadmap", "product roadmap")),
    Concept("backlog", "product", TIER_CORE,
            ("backlog", "backlog grooming", "sprint planning", "story grooming")),
    Concept("user stories", "product", TIER_FOUNDATIONAL,
            ("user story", "user stories", "acceptance criteria")),
    Concept("okrs", "product", TIER_FOUNDATIONAL,
            ("okr", "okrs", "objectives and key results")),
    Concept("kpis", "product", TIER_FOUNDATIONAL,
            ("kpi", "kpis", "key performance indicator", "key performance indicators")),
    Concept("product analytics", "product", TIER_FOUNDATIONAL,
            ("product analytics", "amplitude", "mixpanel")),
    Concept("prd", "product", TIER_FOUNDATIONAL, ("prd", "product requirements document")),
    Concept("a/b testing", "product", TIER_FOUNDATIONAL,
            ("a/b testing", "ab testing", "split testing")),
    Concept("product discovery", "product", TIER_ADVANCED,
            ("product discovery", "customer discovery")),
    Concept("go-to-market", "product", TIER_ADVANCED,
            ("go-to-market", "go to market", "gtm")),
    # --- Sales (family: Sales) ---
    Concept("crm", "sales", TIER_CORE, ("crm", "customer relationship management")),
    Concept("sales pipeline", "sales", TIER_CORE,
            ("sales pipeline", "pipeline management", "deal pipeline")),
    Concept("account management", "sales", TIER_CORE,
            ("account management", "account executive", "key account")),
    Concept("quota attainment", "sales", TIER_FOUNDATIONAL,
            ("quota", "quota attainment", "quota-carrying", "quota carrying")),
    Concept("prospecting", "sales", TIER_FOUNDATIONAL,
            ("prospecting", "cold calling", "cold outreach", "lead generation", "lead gen")),
    Concept("sales forecasting", "sales", TIER_FOUNDATIONAL,
            ("sales forecasting", "revenue forecasting")),
    Concept("sales development", "sales", TIER_FOUNDATIONAL,
            ("sdr", "bdr", "sales development representative",
             "business development representative")),
    Concept("upselling", "sales", TIER_ADVANCED,
            ("upsell", "upselling", "cross-sell", "cross-selling")),
    # --- Finance & accounting (family: Finance) ---
    Concept("fp&a", "finance", TIER_CORE,
            ("fp&a", "fpa", "financial planning and analysis", "financial planning & analysis")),
    Concept("financial reporting", "finance", TIER_CORE,
            ("financial reporting", "financial statements")),
    Concept("reconciliation", "finance", TIER_CORE,
            ("reconciliation", "account reconciliation", "reconciliations", "bank reconciliation")),
    Concept("general ledger", "finance", TIER_FOUNDATIONAL,
            ("general ledger", "journal entries", "month-end close", "month end close")),
    Concept("accounts payable", "finance", TIER_FOUNDATIONAL,
            ("accounts payable", "accounts receivable")),
    Concept("budgeting", "finance", TIER_FOUNDATIONAL,
            ("budgeting", "budget management", "variance analysis")),
    Concept("internal audit", "finance", TIER_FOUNDATIONAL,
            ("internal audit", "external audit", "financial audit")),
    Concept("erp", "finance", TIER_FOUNDATIONAL,
            ("erp", "netsuite", "sap", "oracle financials")),
    Concept("cpa", "finance", TIER_ADVANCED, ("cpa", "certified public accountant")),
    Concept("sox", "finance", TIER_ADVANCED, ("sox", "sarbanes-oxley", "sarbanes oxley")),
)


def _software_concepts() -> tuple[Concept, ...]:
    """Wrap the flat software-skills list as core concepts with coarse categories."""
    return tuple(
        Concept(
            id=canonical,
            category=_CATEGORY_OF_SKILL.get(canonical, "software"),
            tier=TIER_CORE,
            aliases=aliases,
        )
        for canonical, aliases in SKILL_ALIASES.items()
    )


# Jargon sets are listed before the generated software concepts; aliases are
# curated to be distinct, so ``_ALIAS_TO_CONCEPT`` (first mapping wins) needs no
# special-casing.
CONCEPTS: tuple[Concept, ...] = (
    _NETWORKING_CONCEPTS + _DOMAIN_CONCEPTS + _software_concepts()
)

CONCEPT_BY_ID: dict[str, Concept] = {c.id: c for c in CONCEPTS}

# Bidirectional adjacency graph for partial credit.
_RELATED: dict[str, set[str]] = {c.id: set(c.related) for c in CONCEPTS}
for _c in CONCEPTS:
    for _r in _c.related:
        _RELATED.setdefault(_r, set()).add(_c.id)


def related_ids(concept_id: str) -> set[str]:
    """Concepts adjacent to ``concept_id`` (both directions)."""
    return _RELATED.get(concept_id, set())


# alias -> concept id, longest aliases first so multi-word phrases win over the
# unigrams they contain ("local area network" before "switching").
_ALIAS_TO_CONCEPT: dict[str, str] = {}
for _c in CONCEPTS:
    for _alias in _c.aliases:
        _ALIAS_TO_CONCEPT.setdefault(_alias, _c.id)
_ALIASES_BY_LENGTH: list[str] = sorted(_ALIAS_TO_CONCEPT, key=len, reverse=True)


@dataclass
class ConceptHit:
    """A concept found in a block of text, with the phrases that triggered it."""

    concept: Concept
    evidence: list[str] = field(default_factory=list)  # surface phrases matched
    position: int = 0  # first-appearance offset, for stable ordering


def detect_concepts(text: str) -> dict[str, ConceptHit]:
    """All concepts present in ``text``, keyed by concept id, with evidence.

    Word-boundary aware (so ``java`` isn't found in ``javascript`` and ``go``
    isn't found in ``goal``). Multiple aliases of the same concept accumulate as
    evidence phrases.
    """
    norm = normalize(text)
    hits: dict[str, ConceptHit] = {}
    for alias in _ALIASES_BY_LENGTH:
        pattern = r"(?<![a-z0-9])" + re.escape(alias) + r"(?![a-z0-9])"
        m = re.search(pattern, norm)
        if not m:
            continue
        cid = _ALIAS_TO_CONCEPT[alias]
        concept = CONCEPT_BY_ID[cid]
        hit = hits.get(cid)
        if hit is None:
            hits[cid] = ConceptHit(concept=concept, evidence=[alias], position=m.start())
        elif alias not in hit.evidence:
            hit.evidence.append(alias)
            hit.position = min(hit.position, m.start())
    return hits
