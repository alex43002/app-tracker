from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime


# =====================
# Core User Schema
# =====================

class User(BaseModel):
    id: str
    email: EmailStr
    phoneNumber: str
    firstName: str
    lastName: str
    pfp: Optional[str] = None  # GridFS file id, or null
    emailVerified: bool = False
    createdAt: datetime
    updatedAt: datetime


# =====================
# Request Schemas
# =====================

class UpdateUserRequest(BaseModel):
    """Editable core account fields (FEAT-28). All optional — only sent fields
    are changed. Email changes are validated for uniqueness and reset
    verification in the service layer."""

    phoneNumber: Optional[str] = Field(default=None, max_length=40)
    firstName: Optional[str] = Field(default=None, max_length=100)
    lastName: Optional[str] = Field(default=None, max_length=100)
    email: Optional[EmailStr] = None

    @field_validator("phoneNumber", "firstName", "lastName")
    @classmethod
    def _non_empty(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        trimmed = value.strip()
        if not trimmed:
            raise ValueError("must not be blank")
        return trimmed


# =====================
# Response Schemas
# =====================

class UpdateUserResponse(BaseModel):
    updatedAt: datetime
    emailVerified: bool
