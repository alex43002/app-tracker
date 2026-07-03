"""Map a tracked job's URL to the channel it came from (source analytics).

Deterministic, hostname-based classification — no external lookups. Known job
boards and ATS platforms map to friendly names; anything else falls back to the
registrable domain so company career sites still bucket sensibly, and jobs with
no/unparseable URL land in "Direct / other".
"""

from __future__ import annotations

from urllib.parse import urlparse

# Hostname suffix -> friendly source name. Matched by exact host or by
# ``.suffix`` so subdomains (boards.greenhouse.io, acme.myworkdayjobs.com) map
# to the platform.
KNOWN_SOURCES: dict[str, str] = {
    "linkedin.com": "LinkedIn",
    "indeed.com": "Indeed",
    "glassdoor.com": "Glassdoor",
    "ziprecruiter.com": "ZipRecruiter",
    "monster.com": "Monster",
    "dice.com": "Dice",
    "wellfound.com": "Wellfound",
    "angel.co": "Wellfound",
    "otta.com": "Otta",
    "builtin.com": "Built In",
    "simplyhired.com": "SimplyHired",
    "greenhouse.io": "Greenhouse",
    "lever.co": "Lever",
    "ashbyhq.com": "Ashby",
    "recruitee.com": "Recruitee",
    "workable.com": "Workable",
    "myworkdayjobs.com": "Workday",
    "smartrecruiters.com": "SmartRecruiters",
    "jobvite.com": "Jobvite",
    "icims.com": "iCIMS",
    "bamboohr.com": "BambooHR",
}

DIRECT = "Direct / other"


def _registrable_domain(host: str) -> str:
    host = host.lstrip(".")
    if host.startswith("www."):
        host = host[4:]
    parts = host.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def source_from_url(url: str | None) -> str:
    """Classify the channel a job came from based on its URL host."""
    if not url:
        return DIRECT
    try:
        host = (urlparse(url).hostname or "").lower()
    except ValueError:
        host = ""
    if not host:
        return DIRECT
    for domain, name in KNOWN_SOURCES.items():
        if host == domain or host.endswith("." + domain):
            return name
    return _registrable_domain(host) or DIRECT
