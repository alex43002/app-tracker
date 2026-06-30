from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CreateJobAlertRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    # Discovery filter criteria (validated against an allowlist in the service).
    criteria: dict = Field(default_factory=dict)
    notify: bool = True


class UpdateJobAlertRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    criteria: Optional[dict] = None
    notify: Optional[bool] = None


class JobAlert(BaseModel):
    id: str
    name: str
    criteria: dict
    notify: bool
    lastCheckedAt: Optional[datetime] = None
    lastNotifiedAt: Optional[datetime] = None
    lastMatchCount: int = 0
    createdAt: datetime
    updatedAt: datetime


class JobAlertList(BaseModel):
    items: list[JobAlert]


class JobAlertCheck(BaseModel):
    newMatches: int
    total: int
