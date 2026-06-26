from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class SavedSearchBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    # Whitelisted job-list filters (validated against JOB_FILTERABLE_FIELDS).
    filters: dict = Field(default_factory=dict)
    sortBy: str = "createdAt"
    sortOrder: str = "asc"


class CreateSavedSearchRequest(SavedSearchBase):
    pass


class UpdateSavedSearchRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    filters: Optional[dict] = None
    sortBy: Optional[str] = None
    sortOrder: Optional[str] = None


class SavedSearch(SavedSearchBase):
    id: str
    createdAt: datetime
    updatedAt: datetime


class SavedSearchList(BaseModel):
    items: list[SavedSearch]
