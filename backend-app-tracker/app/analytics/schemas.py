from pydantic import BaseModel

class JobStatusCounts(BaseModel):
    applied: int
    interviewing: int
    offer: int
    rejected: int
    total: int