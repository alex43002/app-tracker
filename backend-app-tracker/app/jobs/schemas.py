from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime


# Note: there is intentionally no serialized "Job" response model. Jobs store
# `url` as a plain string; round-tripping it through a pydantic `HttpUrl` would
# normalize it (e.g. append a trailing slash) and silently change the wire
# format clients already depend on. The service serializes jobs directly.


# =====================
# Request Schemas
# =====================

class CreateJobRequest(BaseModel):
    jobId: Optional[str] = None
    url: HttpUrl
    jobTitle: str
    company: str
    salaryTarget: float
    salaryRange: Optional[str] = None
    status: str
    resume: Optional[str] = None
    location: str
    employmentType: str
    notes: Optional[str] = None


class UpdateJobRequest(BaseModel):
    jobId: Optional[str] = None
    url: Optional[HttpUrl] = None
    jobTitle: Optional[str] = None
    company: Optional[str] = None
    salaryTarget: Optional[float] = None
    salaryRange: Optional[str] = None
    status: Optional[str] = None
    resume: Optional[str] = None
    location: Optional[str] = None
    employmentType: Optional[str] = None
    notes: Optional[str] = None


# =====================
# Response Schemas
# =====================

class CreateJobResponse(BaseModel):
    id: str
    createdAt: datetime
    updatedAt: datetime
