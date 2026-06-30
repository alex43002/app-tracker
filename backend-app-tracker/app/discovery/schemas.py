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
