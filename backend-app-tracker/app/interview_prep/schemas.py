from typing import Optional

from pydantic import BaseModel, Field


class GeneratePrepRequest(BaseModel):
    jobDescription: str = Field(min_length=1, max_length=20000)
    jobTitle: Optional[str] = Field(default=None, max_length=200)


class PrepTopic(BaseModel):
    name: str
    kind: str  # "skill" | "theme"


class PrepResult(BaseModel):
    topics: list[PrepTopic]
    technicalQuestions: list[str]
    behavioralQuestions: list[str]
    notes: str
