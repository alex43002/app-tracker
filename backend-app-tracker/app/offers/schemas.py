"""Offer comparison tool: capture and compare competing job offers.

Numeric compensation components plus 1-5 subjective ratings for benefits,
flexibility, and long-term fit. The annual recurring total comp is computed
server-side so every client compares offers consistently.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

OFFER_STATUSES = ("received", "negotiating", "accepted", "declined", "expired")


class CreateOfferRequest(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    role: str = Field(min_length=1, max_length=200)
    location: str = Field(default="", max_length=200)
    baseSalary: Optional[float] = Field(default=None, ge=0)
    bonus: Optional[float] = Field(default=None, ge=0)
    equityPerYear: Optional[float] = Field(default=None, ge=0)
    signOnBonus: Optional[float] = Field(default=None, ge=0)
    benefitsRating: Optional[int] = Field(default=None, ge=1, le=5)
    flexibilityRating: Optional[int] = Field(default=None, ge=1, le=5)
    fitRating: Optional[int] = Field(default=None, ge=1, le=5)
    notes: str = Field(default="", max_length=4000)
    status: str = Field(default="received")


class UpdateOfferRequest(BaseModel):
    company: Optional[str] = Field(default=None, min_length=1, max_length=200)
    role: Optional[str] = Field(default=None, min_length=1, max_length=200)
    location: Optional[str] = Field(default=None, max_length=200)
    baseSalary: Optional[float] = Field(default=None, ge=0)
    bonus: Optional[float] = Field(default=None, ge=0)
    equityPerYear: Optional[float] = Field(default=None, ge=0)
    signOnBonus: Optional[float] = Field(default=None, ge=0)
    benefitsRating: Optional[int] = Field(default=None, ge=1, le=5)
    flexibilityRating: Optional[int] = Field(default=None, ge=1, le=5)
    fitRating: Optional[int] = Field(default=None, ge=1, le=5)
    notes: Optional[str] = Field(default=None, max_length=4000)
    status: Optional[str] = None


class Offer(BaseModel):
    id: str
    company: str
    role: str
    location: str
    baseSalary: Optional[float]
    bonus: Optional[float]
    equityPerYear: Optional[float]
    signOnBonus: Optional[float]
    benefitsRating: Optional[int]
    flexibilityRating: Optional[int]
    fitRating: Optional[int]
    notes: str
    status: str
    totalComp: float  # annual recurring: base + bonus + equity/yr
    createdAt: datetime
    updatedAt: datetime


class OfferList(BaseModel):
    items: list[Offer]
