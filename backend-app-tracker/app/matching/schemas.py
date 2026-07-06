from typing import Optional

from pydantic import BaseModel, Field, HttpUrl, model_validator


# =====================
# Requests
# =====================

class ScrapeJobRequest(BaseModel):
    url: HttpUrl


class ScoreRequest(BaseModel):
    """Score a résumé against a job description.

    Provide a résumé source (an uploaded ``resumeId`` *or* raw ``resumeText``)
    and a job source (a ``jobUrl`` to scrape *or* raw ``jobDescription`` text).
    """

    resumeId: Optional[str] = None
    resumeText: Optional[str] = None
    jobUrl: Optional[HttpUrl] = None
    jobDescription: Optional[str] = Field(default=None, max_length=100_000)

    @model_validator(mode="after")
    def _require_one_of_each(self) -> "ScoreRequest":
        if not (self.resumeId or self.resumeText):
            raise ValueError("Provide a resumeId or resumeText")
        if not (self.jobUrl or self.jobDescription):
            raise ValueError("Provide a jobUrl or jobDescription")
        return self


# =====================
# Responses
# =====================

class ExtractedTerms(BaseModel):
    skills: list[str]
    keywords: list[str]


class ScrapeJobResponse(BaseModel):
    title: str
    textLength: int
    skills: list[str]
    keywords: list[str]


class ExtractResumeResponse(BaseModel):
    """Result of extracting an ad-hoc résumé upload.

    ``text`` is the extracted plain text, echoed back so the client can score
    it via ``resumeText`` without the file being stored server-side.
    """

    filename: str
    textLength: int
    skills: list[str]
    keywords: list[str]
    text: str


class CoverageModel(BaseModel):
    """Per-bucket coverage. ``None`` means the posting had no such section (not
    zero, and never a fake 100%)."""

    required: float | None
    responsibility: float | None
    preferred: float | None
    concept: float | None  # curated-skill signal; None when no concepts detected
    keyword: float


class TermMatchModel(BaseModel):
    term: str
    status: str  # strong | partial | foundational | missing
    bucket: str  # required | responsibility | preferred
    isConcept: bool
    evidence: list[str]  # résumé phrases that earned the match
    category: str | None = None


class ScoreResponse(BaseModel):
    score: int
    confidence: str  # high | medium | low
    confidenceReason: str
    skillSignalAvailable: bool
    contamination: str  # low | medium | high — scraped page-chrome leakage
    roleFamilies: list[str]
    coverage: CoverageModel
    strengths: list[TermMatchModel]
    gaps: list[TermMatchModel]
    resume: ExtractedTerms
    job: ExtractedTerms
