from fastapi import APIRouter, HTTPException
import app.services.pace as paces
import app.utils.durations as durations

router = APIRouter(prefix="/pace-calc", tags=["pace"])

@router.get("")
def calc_pace(
    distance: float | None = None,
    time: str | None = None,
    pace: str | None = None
):
    provided = [p for p in (distance, time, pace) if p is not None]
    if len(provided) != 2:
        raise HTTPException(status_code=400, detail="Please provide exactly two of: distance, time, pace")

    try:
        if distance is not None and time is not None:
            total_seconds = durations.parse_time_hhmmss(time)
            pace_seconds = paces.pace_from_distance_time(distance, total_seconds)
            return {
                "distance": distance,
                "time": durations.format_time_hhmmss(total_seconds),
                "pace": durations.format_pace_mmss_per_mile(pace_seconds),
            }

        if distance is not None and pace is not None:
            pace_seconds = durations.parse_pace_mmss_per_mile(pace)
            total_seconds = paces.time_from_distance_pace(distance, pace_seconds)
            return {
                "distance": distance,
                "time": durations.format_time_hhmmss(total_seconds),
                "pace": durations.format_pace_mmss_per_mile(pace_seconds),
            }

        if time is not None and pace is not None:
            total_seconds = durations.parse_time_hhmmss(time)
            pace_seconds = durations.parse_pace_mmss_per_mile(pace)
            distance_miles = paces.distance_from_time_pace(total_seconds, pace_seconds)
            return {
                "distance": round(distance_miles, 2),
                "time": durations.format_time_hhmmss(total_seconds),
                "pace": durations.format_pace_mmss_per_mile(pace_seconds),
            }

    except ValueError as e:
        # invalid format like "7-30" or "07:99"
        raise HTTPException(status_code=400, detail=str(e)) 