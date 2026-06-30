from typing import Optional

from pydantic import BaseModel, Field


class IngestRequest(BaseModel):
    """Pull a company's public board from an ATS into the discovery store."""

    source: str = Field(description="ATS source, e.g. 'greenhouse' or 'lever'")
    boardToken: str = Field(
        min_length=1,
        max_length=100,
        description="The company's board slug as it appears in its careers URL",
    )
    companyName: Optional[str] = Field(
        default=None, max_length=200, description="Display name (defaults to the slug)"
    )


class IngestResponse(BaseModel):
    source: str
    company: str
    fetched: int
    inserted: int
    updated: int


class SupportedSources(BaseModel):
    sources: list[str]


class ResolveTokenRequest(BaseModel):
    """Extract a board token from a pasted careers URL (FEAT-23)."""

    url: str = Field(min_length=1, max_length=2000, description="A careers page URL")


class ResolveTokenResponse(BaseModel):
    source: str
    boardToken: str


class CompanyDirectoryEntry(BaseModel):
    name: str
    source: str
    boardToken: str


class CompanyDirectory(BaseModel):
    companies: list[CompanyDirectoryEntry]
