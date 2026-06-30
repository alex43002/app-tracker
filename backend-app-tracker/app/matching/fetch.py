"""Guarded fetching of a user-supplied job-posting URL.

Fetching arbitrary URLs on the server's behalf is an SSRF vector, so this module
is deliberately strict:

* only ``http``/``https`` schemes,
* the host must resolve exclusively to public IP addresses (no loopback,
  private, link-local, or otherwise reserved ranges),
* redirects are followed manually and re-validated at every hop,
* the response is size-capped and time-bounded.

On any policy violation a ``FetchError`` is raised with a user-safe message; the
caller maps it to the standard error envelope.
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

import httpx

_MAX_BYTES = 2 * 1024 * 1024  # 2 MB of HTML is plenty for a posting
_TIMEOUT_SECONDS = 8.0
_MAX_REDIRECTS = 4
_USER_AGENT = "CareerLogBot/1.0 (+job-posting-importer)"


class FetchError(Exception):
    """Raised when a URL can't be fetched safely or successfully."""


def _is_public_host(host: str) -> bool:
    """True only if every resolved address for ``host`` is a public IP."""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    if not infos:
        return False
    for info in infos:
        addr = info[4][0]
        try:
            ip = ipaddress.ip_address(addr)
        except ValueError:
            return False
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            return False
    return True


def _validate_url(url: str) -> str:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise FetchError("Only http(s) URLs can be imported")
    if not parsed.hostname:
        raise FetchError("URL is missing a host")
    if not _is_public_host(parsed.hostname):
        raise FetchError("Refusing to fetch a non-public address")
    return url


def fetch_url(url: str) -> str:
    """Fetch ``url`` and return the response body text (HTML).

    Follows redirects manually, re-validating each hop against the SSRF policy.
    """
    current = url
    with httpx.Client(
        follow_redirects=False,
        timeout=_TIMEOUT_SECONDS,
        headers={"User-Agent": _USER_AGENT, "Accept": "text/html,*/*"},
    ) as client:
        for _ in range(_MAX_REDIRECTS + 1):
            _validate_url(current)
            try:
                resp = client.get(current)
            except httpx.HTTPError as exc:
                raise FetchError("Could not reach that URL") from exc

            if resp.is_redirect:
                location = resp.headers.get("location")
                if not location:
                    raise FetchError("Redirect without a destination")
                current = str(resp.url.join(location))
                continue

            if resp.status_code >= 400:
                raise FetchError(f"The posting returned HTTP {resp.status_code}")

            content = resp.content[:_MAX_BYTES]
            encoding = resp.encoding or "utf-8"
            try:
                return content.decode(encoding, errors="ignore")
            except LookupError:
                return content.decode("utf-8", errors="ignore")

    raise FetchError("Too many redirects")
