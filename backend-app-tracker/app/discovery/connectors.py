"""ATS connectors: fetch a company's public board and normalize its postings.

Each connector targets a single ATS's **public, documented JSON API** (no
auth, no HTML scraping):

* Greenhouse — ``boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true``
* Lever      — ``api.lever.co/v0/postings/{token}?mode=json``

A connector takes a company's *board token* (the slug in its careers URL) and
returns a list of normalized posting dicts. Network access goes through the
module-level ``_get_json`` so tests can substitute fixtures.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

import httpx

from app.matching.extract import html_to_text
from app.discovery.normalize import (
    normalize_employment_type,
    normalize_location,
    parse_salary,
)

_TIMEOUT_SECONDS = 10.0
_MAX_BYTES = 5 * 1024 * 1024
_USER_AGENT = "CareerLogBot/1.0 (+job-discovery)"

# Board tokens appear in URLs; restrict to a safe slug charset so a token can't
# smuggle path/host components into the request.
_TOKEN_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$")


class ConnectorError(Exception):
    """Raised when a board can't be fetched or parsed."""


def valid_token(token: str) -> bool:
    return bool(_TOKEN_RE.match(token or ""))


def _get_json(url: str):
    """Fetch and parse JSON from a known ATS host. Monkeypatched in tests."""
    try:
        with httpx.Client(
            timeout=_TIMEOUT_SECONDS,
            follow_redirects=True,
            headers={"User-Agent": _USER_AGENT, "Accept": "application/json"},
        ) as client:
            resp = client.get(url)
    except httpx.HTTPError as exc:
        raise ConnectorError("Could not reach the ATS") from exc

    if resp.status_code == 404:
        raise ConnectorError("Unknown company board for this source")
    if resp.status_code >= 400:
        raise ConnectorError(f"ATS returned HTTP {resp.status_code}")
    if len(resp.content) > _MAX_BYTES:
        raise ConnectorError("ATS response too large")
    try:
        return resp.json()
    except ValueError as exc:
        raise ConnectorError("ATS returned invalid JSON") from exc


def _parse_iso(value) -> datetime | None:
    if not value or not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _parse_epoch_ms(value) -> datetime | None:
    if not isinstance(value, (int, float)):
        return None
    try:
        return datetime.fromtimestamp(value / 1000, tz=timezone.utc)
    except (ValueError, OverflowError, OSError):
        return None


# --------------------------------------------------------------------------- #
# Greenhouse
# --------------------------------------------------------------------------- #

def fetch_greenhouse(token: str, company: str | None = None) -> list[dict]:
    url = f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true"
    data = _get_json(url)
    jobs = data.get("jobs", []) if isinstance(data, dict) else []
    company_name = company or token
    out: list[dict] = []
    for job in jobs:
        content_html = job.get("content") or ""
        # Greenhouse double-encodes HTML entities in `content`.
        description, _ = html_to_text(_unescape_basic(content_html))
        location = normalize_location((job.get("location") or {}).get("name"))
        sal_min, sal_max = parse_salary(description)
        out.append(
            {
                "source": "greenhouse",
                "sourceId": str(job.get("id")),
                "company": company_name,
                "title": (job.get("title") or "").strip(),
                "location": location,
                "employmentType": None,  # Greenhouse boards rarely expose this
                "url": job.get("absolute_url"),
                "description": description,
                "salaryMin": sal_min,
                "salaryMax": sal_max,
                "postedAt": _parse_iso(job.get("updated_at")),
            }
        )
    return out


def _unescape_basic(s: str) -> str:
    import html as _html

    return _html.unescape(s)


# --------------------------------------------------------------------------- #
# Lever
# --------------------------------------------------------------------------- #

def fetch_lever(token: str, company: str | None = None) -> list[dict]:
    url = f"https://api.lever.co/v0/postings/{token}?mode=json"
    data = _get_json(url)
    postings = data if isinstance(data, list) else []
    company_name = company or token
    out: list[dict] = []
    for post in postings:
        categories = post.get("categories") or {}
        description = (post.get("descriptionPlain") or "").strip()
        sal_min, sal_max = parse_salary(description)
        out.append(
            {
                "source": "lever",
                "sourceId": str(post.get("id")),
                "company": company_name,
                "title": (post.get("text") or "").strip(),
                "location": normalize_location(categories.get("location")),
                "employmentType": normalize_employment_type(
                    categories.get("commitment")
                ),
                "url": post.get("hostedUrl"),
                "description": description,
                "salaryMin": sal_min,
                "salaryMax": sal_max,
                "postedAt": _parse_epoch_ms(post.get("createdAt")),
            }
        )
    return out


# source name -> connector callable
CONNECTORS = {
    "greenhouse": fetch_greenhouse,
    "lever": fetch_lever,
}

SUPPORTED_SOURCES = tuple(CONNECTORS)


def fetch_source(source: str, token: str, company: str | None = None) -> list[dict]:
    """Dispatch to the connector for ``source``; validates the board token."""
    connector = CONNECTORS.get(source)
    if connector is None:
        raise ConnectorError(f"Unsupported source: {source}")
    if not valid_token(token):
        raise ConnectorError("Invalid company board token")
    return connector(token, company)
