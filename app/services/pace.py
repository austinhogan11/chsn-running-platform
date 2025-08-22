def pace_from_distance_time(distance: float, total_seconds: int) -> int:
    """Return pace in seconds per unit (mile or km), rounded to nearest int."""
    return int(round(total_seconds / distance))


def time_from_distance_pace(distance: float, pace_seconds_per_unit: int) -> int:
    """Return total time in seconds, given distance (miles/km) and pace (s per unit)."""
    return int(round(distance * pace_seconds_per_unit))


def distance_from_time_pace(total_seconds: int, pace_seconds_per_unit: int) -> float:
    """Return distance (miles/km) as float, given time (s) and pace (s per unit)."""
    return total_seconds / pace_seconds_per_unit