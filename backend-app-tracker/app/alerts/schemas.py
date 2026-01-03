from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


# =====================
# Core Alert Schema
# =====================

class Alert(BaseModel):
    id: str
    userId: str

    scheduledAlert: datetime
    smsOrEmail: Literal["sms", "email"]
    message: str

    lastAlertAt: Optional[datetime] = None

    createdAt: datetime
    updatedAt: datetime


# =====================
# Request Schemas
# =====================

class CreateAlertRequest(BaseModel):
    scheduledAlert: datetime
    smsOrEmail: Literal["sms", "email"]
    message: str


class UpdateAlertRequest(BaseModel):
    scheduledAlert: Optional[datetime] = None
    smsOrEmail: Optional[Literal["sms", "email"]] = None
    message: Optional[str] = None


# =====================
# Response Schemas
# =====================

class CreateAlertResponse(BaseModel):
    id: str
    createdAt: datetime
    updatedAt: datetime
