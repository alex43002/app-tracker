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
    """Collect visible text, dropping script/style/head noise."""

    # Note: <head> is *not* skipped wholesale — we still want its <title>. The
    # noise inside head (script/style) is skipped by these tags directly.
    _SKIP = {"script", "style", "noscript", "svg"}
    _BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "section"}

    def __init__(self) -> None:
        super().__init__()
        self._parts: list[str] = []
        self._skip_depth = 0
        self.title = ""
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        if tag in self._SKIP:
            self._skip_depth += 1
        if tag == "title":
            self._in_title = True
        if tag in self._BLOCK:
            self._parts.append("\n")

    def handle_endtag(self, tag):
        if tag in self._SKIP and self._skip_depth > 0:
            self._skip_depth -= 1
        if tag == "title":
            self._in_title = False
        if tag in self._BLOCK:
            self._parts.append("\n")

    def handle_data(self, data):
        if self._skip_depth:
            return
        if self._in_title and not self.title:
            self.title = data.strip()
        self._parts.append(data)

    def text(self) -> str:
        joined = "".join(self._parts)
        # Collapse runs of blank lines/whitespace introduced by block tags.
        joined = re.sub(r"[ \t]+", " ", joined)
        joined = re.sub(r"\n\s*\n+", "\n", joined)
        return joined.strip()


def html_to_text(html: str) -> tuple[str, str]:
    """Reduce an HTML document to (visible_text, title)."""
    parser = _TextHTMLParser()
    try:
        parser.feed(html or "")
    except Exception:
        return "", ""
    return parser.text(), parser.title
