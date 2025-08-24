# app/api/pace_calc.py
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from enum import Enum
from pydantic import BaseModel

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

router = APIRouter()

class UnitEnum(str, Enum):
    miles = "mi"
    km = "km"

class PaceCalcResponse(BaseModel):
    distance: float | None
    time: str | None
    pace: str | None
    unit: UnitEnum

@router.get(
    "/pace-calc",
    response_model=PaceCalcResponse,
    summary="Calculate the missing run metric (distance, time, or pace)",
    response_description="Returns the calculated trio (distance, time, pace) for the selected unit."
)
def pace_calc(
    distance: Optional[float] = Query(None, description="Distance value in the selected unit"),
    time: Optional[str] = Query(None, description="Time as HH:MM:SS (supports MM:SS too)"),
    pace: Optional[str] = Query(None, description="Pace as MM:SS (per selected unit)"),
    unit: UnitEnum = Query(UnitEnum.miles, description="Unit of distance ('miles' or 'km')"),
):
    """
    Provide exactly TWO of: distance, time, pace.
    - `unit` controls the semantics of distance and pace (miles vs km). Math is unit-agnostic.
    """

    # Parse inputs
    if time:
        try:
            time_seconds = parse_time_hhmmss(time)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        time_seconds = None
    if pace:
        try:
            pace_seconds_per_unit = parse_pace_mmss(pace)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
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
        pace=format_pace_mmss(int(round(pace_seconds_per_unit))) if pace_seconds_per_unit is not None else None,
    )