from pydantic import BaseModel, EmailStr
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
    pfp: str
    createdAt: datetime
    updatedAt: datetime


# =====================
# Request Schemas
# =====================

class UpdateUserRequest(BaseModel):
    phoneNumber: Optional[str] = None
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    pfp: Optional[str] = None


# =====================
# Response Schemas
# =====================

class UpdateUserResponse(BaseModel):
    updatedAt: datetime
