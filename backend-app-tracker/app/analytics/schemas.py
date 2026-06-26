from pydantic import BaseModel


class JobStatusCounts(BaseModel):
    applied: int
    interviewing: int
    offer: int
    rejected: int
    total: int


# ---- Richer analytics (FEAT-7) ----


class Funnel(JobStatusCounts):
    """Status counts plus headline conversion rates (each a 0..1 ratio)."""

    responseRate: float
    interviewRate: float
    offerRate: float


class TimePoint(BaseModel):
    period: str  # "YYYY-MM"
    count: int


class ApplicationsOverTime(BaseModel):
    interval: str  # currently always "month"
    points: list[TimePoint]


class TimeToOffer(BaseModel):
    offers: int
    averageDays: float | None
    medianDays: float | None


class CompanyFunnel(JobStatusCounts):
    company: str


class CompanyFunnels(BaseModel):
    companies: list[CompanyFunnel]