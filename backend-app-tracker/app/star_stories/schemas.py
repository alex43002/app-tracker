"""STAR story library (interview prep): reusable behavioral-interview stories.

Each story captures the classic Situation / Task / Action / Result structure,
plus a title and freeform tags so users can organize and reuse them across
behavioral questions.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class CreateStarStoryRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    situation: str = Field(default="", max_length=4000)
    task: str = Field(default="", max_length=4000)
    action: str = Field(default="", max_length=4000)
    result: str = Field(default="", max_length=4000)
    tags: list[str] = Field(default_factory=list, max_length=30)


class UpdateStarStoryRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    situation: Optional[str] = Field(default=None, max_length=4000)
    task: Optional[str] = Field(default=None, max_length=4000)
    action: Optional[str] = Field(default=None, max_length=4000)
    result: Optional[str] = Field(default=None, max_length=4000)
    tags: Optional[list[str]] = Field(default=None, max_length=30)


class StarStory(BaseModel):
    id: str
    title: str
    situation: str
    task: str
    action: str
    result: str
    tags: list[str]
    createdAt: datetime
    updatedAt: datetime


class StarStoryList(BaseModel):
    items: list[StarStory]
