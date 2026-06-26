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
    # Profile pictures are uploaded separately (PUT /api/users/{id}/pfp).


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refreshToken: str


class LogoutRequest(BaseModel):
    refreshToken: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    newPassword: str = Field(min_length=8)


class EmailVerificationRequest(BaseModel):
    email: EmailStr


class EmailVerificationConfirm(BaseModel):
    token: str


# =====================
# Response Schemas
# =====================

class UserAuthResponse(BaseModel):
    id: str
    email: EmailStr
    phoneNumber: str
    firstName: str
    lastName: str
    pfp: Optional[str] = None
    emailVerified: bool = False
    createdAt: datetime
    updatedAt: datetime


class AuthTokenResponse(BaseModel):
    user: UserAuthResponse
    jwt: str
    expiresAt: datetime
    refreshToken: str
    refreshExpiresAt: datetime
