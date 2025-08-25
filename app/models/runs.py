# app/models/runs.py
from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, PositiveFloat


class UnitEnum(str, Enum):
    mi = "mi"
    km = "km"


class RunCreate(BaseModel):
    title: str = Field(..., max_length=120)
    description: Optional[str] = None
    started_at: datetime  # local or UTC; we store as ISO-8601 string
    distance: PositiveFloat
    unit: UnitEnum = UnitEnum.mi
    duration_s: int = Field(..., ge=1)  # total seconds

    # Optional: computed on the server
    pace_s: Optional[int] = None
    pace: Optional[str] = None  # "MM:SS"


class Run(RunCreate):
    id: int