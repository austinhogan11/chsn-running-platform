def pace_from_distance_time(distance_miles: float, total_seconds: int) -> int:
    """Return pace in seconds per mile."""
    return total_seconds / distance_miles

def time_from_distance_pace(distance_miles: float, pace_seconds_per_mile: int) -> int:
    """Return total time in seconds."""
    return distance_miles * pace_seconds_per_mile

def distance_from_time_pace(total_seconds: int, pace_seconds_per_mile: int) -> float:
    """Return distance in miles (float)."""
    return total_seconds / pace_seconds_per_mile