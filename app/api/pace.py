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
    provided_values = [p for p in (distance, time, pace) if p is not None]
    if len(provided_values) != 2:
        raise HTTPException(status_code=400, detail="Please provide exactly two of: distance, time, pace")
    
    if distance and time:
        total_seconds = durations.parse_time_hhmmss(time)
        pace_seconds = paces.pace_from_distance_time(distance, total_seconds)
        return {
            "distance" : distance,
            "time"     : durations.format_time_hhmmss(total_seconds),
            "pace"     : durations.format_pace_mmss_per_mile(int(pace_seconds))
        }
    elif distance and pace:
        pace_seconds = durations.parse_pace_mmss_per_mile(pace)
        total_seconds = paces.time_from_distance_pace(distance, pace_seconds)
        return {
            "distance" : distance,
            "time"     : durations.format_time_hhmmss(int(total_seconds)),
            "pace"     : durations.format_pace_mmss_per_mile(int(pace_seconds))
        }
    elif time and pace:
        total_seconds = durations.parse_time_hhmmss(time)
        pace_seconds = durations.parse_pace_mmss_per_mile(pace)
        distance_miles = paces.distance_from_time_pace(total_seconds, pace_seconds)
        return {
            "distance" : round(distance_miles, 2),
            "time"     : durations.format_time_hhmmss(total_seconds),
            "pace"     : durations.format_pace_mmss_per_mile(int(pace_seconds))
        }
    