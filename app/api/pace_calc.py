# app/api/pace_calc.py
"""Pace calculator API endpoints for the CHSN Running platform.

This router exposes a single endpoint that accepts exactly two of the three
run metrics—**distance**, **time**, **pace**—and calculates the missing one.
The math is unit‑agnostic (miles or kilometers) and the result is returned in a
consistent, human‑readable format.

Usage examples
--------------
- Given distance and time → compute pace
  - `/pace-calc?distance=5&time=00:40:00&unit=mi`
- Given time and pace → compute distance
  - `/pace-calc?time=01:30:00&pace=08:00&unit=mi`
- Given distance and pace → compute time
  - `/pace-calc?distance=10&pace=04:30&unit=km`

Notes
-----
- `time` accepts `HH:MM:SS` or `MM:SS`.
- `pace` accepts `MM:SS` (per selected unit).
- `distance` is a float in the selected unit.
"""
from typing import Optional
from enum import Enum

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.pace_calc import (
    pace_from_distance_time,
    time_from_distance_pace,
    distance_from_time_pace,
)
from app.utils.durations import (
    parse_time_hhmmss,
    format_time_hhmmss,
    parse_pace_mmss,
    format_pace_mmss,
)

# Router-level metadata keeps OpenAPI tidy for this feature area
router = APIRouter(tags=["Pace Calculator"])  # path preserved as /pace-calc below


class UnitEnum(str, Enum):
    """Supported distance/pace units."""

    miles = "mi"
    km = "km"


class PaceCalcResponse(BaseModel):
    """Response payload for pace calculations."""

    distance: float | None = Field(
        None, description="Distance in the selected unit (rounded to 2 decimals)"
    )
    time: str | None = Field(None, description="Elapsed time formatted as HH:MM:SS")
    pace: str | None = Field(None, description="Pace formatted as MM:SS per selected unit")
    unit: UnitEnum = Field(description="Unit of distance and corresponding pace")


@router.get(
    "/pace-calc",
    response_model=PaceCalcResponse,
    summary="Calculate the missing run metric (distance, time, or pace)",
    response_description="Returns the calculated trio (distance, time, pace) for the selected unit.",
    responses={
        400: {
            "description": "Invalid input or wrong number of parameters provided",
            "content": {
                "application/json": {
                    "examples": {
                        "not_enough": {
                            "summary": "Only one metric provided",
                            "value": {"detail": "Provide exactly two of distance, time, pace"},
                        },
                        "too_many": {
                            "summary": "All three metrics provided",
                            "value": {"detail": "Provide exactly two of distance, time, pace"},
                        },
                        "bad_time": {
                            "summary": "Malformed time",
                            "value": {"detail": "Time must be in HH:MM:SS or MM:SS"},
                        },
                        "bad_pace": {
                            "summary": "Malformed pace",
                            "value": {"detail": "Pace must be in MM:SS"},
                        },
                    }
                }
            },
        }
    },
)
def pace_calc(
    distance: Optional[float] = Query(
        None,
        description="Distance value in the selected unit (must be > 0)",
        examples={"five_miles": {"summary": "Example distance", "value": 5.0}},
    ),
    time: Optional[str] = Query(
        None,
        description="Time as HH:MM:SS (supports MM:SS)",
        examples={
            "forty_min": {"summary": "40 minutes", "value": "00:40:00"},
            "ninety_min": {"summary": "90 minutes", "value": "01:30:00"},
        },
    ),
    pace: Optional[str] = Query(
        None,
        description="Pace as MM:SS (per selected unit)",
        examples={"eight_flat": {"summary": "8 min per mi/km", "value": "08:00"}},
    ),
    unit: UnitEnum = Query(
        UnitEnum.miles,
        description="Unit of distance ('mi' for miles, 'km' for kilometers)",
        examples={"miles": {"summary": "Miles", "value": "mi"}, "km": {"summary": "Kilometers", "value": "km"}},
    ),
) -> PaceCalcResponse:
    """Calculate the missing metric from exactly two provided values.

    Parameters
    ----------
    distance:
        Distance value in the selected unit. Must be positive when provided.
    time:
        Elapsed time, formatted as ``HH:MM:SS`` or ``MM:SS``.
    pace:
        Pace per unit, formatted as ``MM:SS``.
    unit:
        Controls the semantics of distance and pace (``mi`` vs ``km``). Math is unit‑agnostic.

    Returns
    -------
    PaceCalcResponse
        The completed triplet (distance, time, pace) and the chosen unit.
    """

    # Basic numeric guardrails for cleaner errors up front
    if distance is not None and distance <= 0:
        raise HTTPException(status_code=400, detail="Distance must be greater than 0")

    # Parse inputs
    if time is not None:
        try:
            time_seconds = parse_time_hhmmss(time)
        except ValueError as e:
            # Normalize parse errors for consistent OpenAPI examples
            raise HTTPException(status_code=400, detail=str(e) or "Time must be in HH:MM:SS or MM:SS")
    else:
        time_seconds = None

    if pace is not None:
        try:
            pace_seconds_per_unit = parse_pace_mmss(pace)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e) or "Pace must be in MM:SS")
    else:
        pace_seconds_per_unit = None

    # Validate exactly two provided
    provided = sum(x is not None for x in (distance, time_seconds, pace_seconds_per_unit))
    if provided != 2:
        raise HTTPException(status_code=400, detail="Provide exactly two of distance, time, pace")

    # Compute the missing third (unit-agnostic math)
    if distance is not None and time_seconds is not None:
        pace_seconds_per_unit = pace_from_distance_time(distance, time_seconds)
    elif time_seconds is not None and pace_seconds_per_unit is not None:
        distance = distance_from_time_pace(time_seconds, pace_seconds_per_unit)
    elif distance is not None and pace_seconds_per_unit is not None:
        time_seconds = time_from_distance_pace(distance, pace_seconds_per_unit)

    # Build response (format for humans)
    return PaceCalcResponse(
        unit=unit,
        distance=round(distance, 2) if distance is not None else None,
        time=format_time_hhmmss(time_seconds) if time_seconds is not None else None,
        pace=(
            format_pace_mmss(int(round(pace_seconds_per_unit)))
            if pace_seconds_per_unit is not None
            else None
        ),
    )