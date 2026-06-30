from typing import Optional

from pydantic import BaseModel, Field


class ClassifyEmailRequest(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    subject: Optional[str] = Field(default=None, max_length=500)


class MatchedJob(BaseModel):
    id: str
    jobTitle: str
    company: str
    status: str


class EmailClassification(BaseModel):
    category: str  # offer|rejection|interview|application_received|recruiter|other
    suggestedStatus: Optional[str]  # applied|interviewing|offer|rejected|None
    signals: list[str]
    confidence: str  # low|medium|high
    matchedJobs: list[MatchedJob]
