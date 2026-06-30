"""Resume ↔ job matching (FEAT-21).

A small, deterministic, dependency-light engine that:

* extracts plain text from résumé uploads (txt / pdf / docx) and job postings
  (raw text or a scraped URL),
* pulls skills/keywords out of that text (no generative AI — a curated skills
  taxonomy plus classic frequency-based keyword extraction), and
* scores a résumé against a job description, surfacing the matched terms and the
  gaps so a seeker can see their fit before applying.

The constraint for this epic is *no generative AI*; classic NLP is fine. Every
function here is pure and unit-testable so the score is explainable and stable.
"""
