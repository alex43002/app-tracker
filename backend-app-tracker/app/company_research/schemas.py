from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class Facet(BaseModel):
    value: str
    count: int


class CompanyRef(BaseModel):
    name: str
    openRoles: int


class CompanyList(BaseModel):
    companies: list[CompanyRef]


class CompanySnapshot(BaseModel):
    company: str
    found: bool
    openRoles: int
    sources: list[str]
    locations: list[Facet]
    employmentTypes: list[Facet]
    experienceLevels: list[Facet]
    workArrangements: list[Facet]
    topSkills: list[Facet]
    sampleTitles: list[str]
    salaryMin: Optional[int]
    salaryMax: Optional[int]
    latestPostedAt: Optional[datetime]
