from pydantic import BaseModel

class JobStatusCounts(BaseModel):
    applied: int
    interviewing: int
    offer: int
    denied: int
    total: int