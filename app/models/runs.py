# app/models/runs.py
"""Pydantic models and enums for run logs.

These models are shared across routers/services so we keep them framework-agnostic
and well-documented. They intentionally mirror the current API payloads.

Notes
-----
- `RunCreate` is the client payload for creating/updating runs.
- `Run` extends `RunCreate` by adding a server-assigned integer `id`.
- Optional `pace_s`/`pace` can be computed on the server from `distance` and
  `duration_s` (e.g., in a service layer) and echoed back to clients.
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, PositiveFloat


class UnitEnum(str, Enum):
    """Distance units used across the app (and for pace semantics)."""

    mi = "mi"
    km = "km"


class RunTypeEnum(str, Enum):
    """High-level categorization for runs used in filtering and analytics."""

    easy = "Easy Run"
    workout = "Workout"
    long = "Long Run"
    race = "Race"


class RunCreate(BaseModel):
    """Payload for creating/updating a run.

    This mirrors the current API contract. Keep field names stable to avoid
    breaking clients.
    """

    title: str = Field(
        ..., max_length=120, description="Short label for the run (e.g., 'Tempo 3x1mi')"
    )
    description: Optional[str] = Field(
        default=None, description="Freeform notes: route, weather, HR, splits, etc."
    )
    started_at: datetime = Field(
        ..., description="Start datetime (ISO 8601, timezone-aware preferred)"
    )
    distance: PositiveFloat = Field(
        ..., description="Distance in the selected unit (> 0)"
    )
    unit: UnitEnum = Field(
        default=UnitEnum.mi, description="Unit for distance ('mi' or 'km')"
    )
    duration_s: int = Field(
        ..., ge=1, description="Total elapsed time in whole seconds (> 0)"
    )
    run_type: RunTypeEnum = Field(
        default=RunTypeEnum.easy, description="Categorization of the run"
    )

    # Optional server-computed conveniences
    elevation_ft: Optional[float] = Field(
        default=None, description="Total elevation gain in feet (optional)"
    )
    source: Optional[str] = Field(
        default=None, description="Source system for the run (e.g., 'strava')"
    )
    source_ref: Optional[str] = Field(
        default=None, description="Reference id in the source system"
    )
    
    # Derived values
    pace_s: Optional[int] = Field(
        default=None,
        description="Pace in seconds per unit (derived from distance & duration)",
    )
    pace: Optional[str] = Field(
        default=None, description="Human-friendly pace 'MM:SS' per selected unit"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "title": "Easy neighborhood loop",
                    "description": "Felt smooth. Kept HR < 150.",
                    "started_at": "2025-09-10T07:15:00-04:00",
                    "distance": 5.2,
                    "unit": "mi",
                    "duration_s": 2700,
                    "run_type": "Easy Run",
                    "pace_s": 519,
                    "pace": "08:39",
                }
            ]
        }
    }


class Run(RunCreate):
    """Stored run with a server-assigned identifier."""

    id: int = Field(description="Server-generated integer identifier")
