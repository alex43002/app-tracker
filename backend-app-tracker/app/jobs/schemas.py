from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime


# =====================
# Core Job Schema
# =====================

class Job(BaseModel):
    id: str
    userId: str

    jobId: Optional[str] = None
    url: HttpUrl

    jobTitle: str
    company: str   # NEW

    salaryTarget: float
    salaryRange: Optional[str] = None

    status: str
    resume: str
    location: str
    employmentType: str

    createdAt: datetime
    updatedAt: datetime



# =====================
# Request Schemas
# =====================

class CreateJobRequest(BaseModel):
    jobId: Optional[str] = None
    url: HttpUrl
    jobTitle: str
    company: str   # NEW
    salaryTarget: float
    salaryRange: Optional[str] = None
    status: str
    resume: str
    location: str
    employmentType: str



class UpdateJobRequest(BaseModel):
    jobId: Optional[str] = None
    url: Optional[HttpUrl] = None
    jobTitle: Optional[str] = None
    company: Optional[str] = None   # NEW
    salaryTarget: Optional[float] = None
    salaryRange: Optional[str] = None
    status: Optional[str] = None
    resume: Optional[str] = None
    location: Optional[str] = None
    employmentType: Optional[str] = None



# =====================
# Response Schemas
# =====================

class CreateJobResponse(BaseModel):
    id: str
    createdAt: datetime
    updatedAt: datetime
