"""Plain-text extraction from résumé uploads and HTML job postings.

Résumés arrive as ``text/plain``, ``application/pdf`` or ``.docx`` (the same
types the jobs upload endpoint accepts). DOCX is unzipped and parsed with the
stdlib (no ``python-docx``/``lxml`` build dependency); PDF uses the pure-Python
``pypdf``. HTML postings are reduced to readable text with a small stdlib
parser so we avoid pulling in BeautifulSoup.

Extraction is best-effort: an unreadable or empty document yields ``""`` rather
than raising, and the caller decides how to surface "couldn't read this file".
"""

from __future__ import annotations

import io
import re
import zipfile
from html.parser import HTMLParser
from xml.etree import ElementTree

_DOCX_TEXT_TAG = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"
_DOCX_PARA_TAG = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"


def _decode_text(data: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return data.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            continue
    return data.decode("utf-8", errors="ignore")


def _extract_docx(data: bytes) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            xml = zf.read("word/document.xml")
    except (zipfile.BadZipFile, KeyError):
        return ""
    try:
        root = ElementTree.fromstring(xml)
    except ElementTree.ParseError:
        return ""

    # Join runs within a paragraph, then paragraphs with newlines so word
    # boundaries (and thus keywords) survive.
    lines: list[str] = []
    for para in root.iter(_DOCX_PARA_TAG):
        text = "".join(node.text or "" for node in para.iter(_DOCX_TEXT_TAG))
        if text.strip():
            lines.append(text)
    return "\n".join(lines)


def _dehyphenate(text: str) -> str:
    """Repair PDF/LaTeX line-wrap artifacts that shred keyword matching.

    Résumés exported from LaTeX/Word routinely hyphenate across line breaks
    (``trou-\\nbleshooting``) and hard-wrap mid-sentence. Left as-is, the parser
    would never match "troubleshooting". Join a hyphen-newline back into one
    word, but keep genuine hyphenated compounds (``ticket-based``) intact by
    only collapsing when a lowercase letter directly follows the break.
    """
    if not text:
        return text
    # word-continuation: "trou-\n bleshooting" -> "troubleshooting"
    return re.sub(r"(\w)-\s*\n\s*([a-z])", r"\1\2", text)


def _extract_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader  # imported lazily so the dep is optional
    except ImportError:
        return ""
    try:
        reader = PdfReader(io.BytesIO(data))
        return _dehyphenate("\n".join(page.extract_text() or "" for page in reader.pages))
    except Exception:
        # pypdf raises a variety of errors on malformed/encrypted PDFs; a
        # résumé we can't read should degrade to "no text", not a 500.
        return ""


# Content-type / extension → extractor. Content-type is authoritative; the
# filename extension is a fallback for clients that send octet-stream.
def extract_resume_text(
    data: bytes, *, content_type: str | None = None, filename: str | None = None
) -> str:
    """Best-effort plain text from résumé bytes. Returns ``""`` if unreadable."""
    ctype = (content_type or "").lower()
    name = (filename or "").lower()

    if "pdf" in ctype or name.endswith(".pdf"):
        return _extract_pdf(data).strip()
    if (
        "wordprocessingml" in ctype
        or "officedocument" in ctype
        or name.endswith(".docx")
    ):
        return _extract_docx(data).strip()
    if ctype.startswith("text/") or name.endswith((".txt", ".md")) or not ctype:
        return _decode_text(data).strip()
    # Legacy .doc and anything else: try a tolerant decode as a last resort.
    return _decode_text(data).strip()


class _TextHTMLParser(HTMLParser):
    """Collect *readable* text from a scraped page, dropping chrome.

    Scraped job pages are mostly navigation, footers, cookie banners and
    "related jobs" rails — text that leaks into the requirement list and drags
    the match score down (FEAT-31). We drop it structurally, before any keyword
    extraction, three ways:

    * whole noise tags (``nav``/``footer``/``aside``/``form``/``button``/…) and
      ``script``/``style`` are skipped along with everything nested inside them;
    * containers are skipped by ARIA ``role`` (navigation/banner/contentinfo/
      search) and by chrome hints in their ``class``/``id`` (nav, footer,
      cookie, breadcrumb, sidebar, related, recommend, subscribe …);
    * if the page marks its real content with ``<main>``/``<article>``, only
      that region is returned — the single biggest win against page chrome.
    """

    # Always-noise tags: dropped with their whole subtree. <head> is not here so
    # its <title> survives; script/style inside head are dropped by name.
    _SKIP_TAGS = {
        "script", "style", "noscript", "svg", "template",
        "nav", "footer", "aside", "form", "button", "select", "option",
    }
    _BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section"}
    _MAIN_TAGS = {"main", "article"}
    # Void elements never carry an end tag, so they must not go on the stack.
    _VOID = {
        "br", "img", "input", "hr", "meta", "link", "area", "base", "col",
        "embed", "source", "track", "wbr",
    }
    _SKIP_ROLES = {"navigation", "banner", "contentinfo", "search"}
    _CHROME_HINTS = (
        "nav", "menu", "footer", "cookie", "banner", "breadcrumb", "sidebar",
        "related", "recommend", "subscribe", "promo", "social", "share",
    )

    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []
        self._main_parts: list[str] = []
        # Stack of (tag, starts_skip, starts_main) so we can unwind chrome
        # regions even when the markup nests or is imperfectly closed.
        self._stack: list[tuple[str, bool, bool]] = []
        self._skip_depth = 0
        self._main_depth = 0
        self.title = ""
        self._in_title = False

    @classmethod
    def _is_chrome(cls, attrs) -> bool:
        attr = {k: (v or "") for k, v in attrs}
        if attr.get("role", "").lower() in cls._SKIP_ROLES:
            return True
        hint_text = f"{attr.get('class', '')} {attr.get('id', '')}".lower()
        return any(h in hint_text for h in cls._CHROME_HINTS)

    def _emit(self, text: str) -> None:
        self._parts.append(text)
        if self._main_depth and not self._skip_depth:
            self._main_parts.append(text)

    def handle_starttag(self, tag, attrs):
        if tag == "title":
            self._in_title = True
        if tag in self._VOID:
            return
        starts_skip = tag in self._SKIP_TAGS or self._is_chrome(attrs)
        starts_main = tag in self._MAIN_TAGS
        self._stack.append((tag, starts_skip, starts_main))
        if starts_skip:
            self._skip_depth += 1
        if starts_main:
            self._main_depth += 1
        if tag in self._BLOCK:
            self._emit("\n")

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag in self._BLOCK:
            self._emit("\n")
        # Unwind to the matching open tag (tolerating unclosed inner tags).
        for i in range(len(self._stack) - 1, -1, -1):
            if self._stack[i][0] == tag:
                for _, was_skip, was_main in self._stack[i:]:
                    if was_skip:
                        self._skip_depth -= 1
                    if was_main:
                        self._main_depth -= 1
                del self._stack[i:]
                break

    def handle_data(self, data):
        if self._in_title and not self.title:
            self.title = data.strip()
        if self._skip_depth:
            return
        self._emit(data)

    @staticmethod
    def _collapse(parts: list[str]) -> str:
        joined = "".join(parts)
        joined = re.sub(r"[ \t]+", " ", joined)
        joined = re.sub(r"\n\s*\n+", "\n", joined)
        return joined.strip()

    def text(self) -> str:
        # Prefer the <main>/<article> region when it carries real content;
        # otherwise fall back to the whole (chrome-filtered) body.
        main = self._collapse(self._main_parts)
        return main if len(main) >= 40 else self._collapse(self._parts)


def html_to_text(html: str) -> tuple[str, str]:
    """Reduce an HTML document to (visible_text, title)."""
    parser = _TextHTMLParser()
    try:
        parser.feed(html or "")
    except Exception:
        return "", ""
    return parser.text(), parser.title
