from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


# =====================
# Request Schemas
# =====================

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    phoneNumber: str
    firstName: str
    lastName: str
    pfp: str  # base64 or binary encoded string


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    jwt: str


# =====================
# Response Schemas
# =====================

class UserAuthResponse(BaseModel):
    id: str
    email: EmailStr
    phoneNumber: str
    firstName: str
    lastName: str
    pfp: str
    createdAt: datetime
    updatedAt: datetime


class AuthTokenResponse(BaseModel):
    user: UserAuthResponse
    jwt: str
    expiresAt: datetime
