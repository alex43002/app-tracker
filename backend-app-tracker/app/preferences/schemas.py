from typing import Optional

from pydantic import BaseModel, Field


class Preferences(BaseModel):
    preferredCompanies: list[str] = Field(default_factory=list)
    hiddenCompanies: list[str] = Field(default_factory=list)
    hiddenEmploymentTypes: list[str] = Field(default_factory=list)


class UpdatePreferencesRequest(BaseModel):
    """Partial update — only provided lists are replaced."""

    preferredCompanies: Optional[list[str]] = None
    hiddenCompanies: Optional[list[str]] = None
    hiddenEmploymentTypes: Optional[list[str]] = None
