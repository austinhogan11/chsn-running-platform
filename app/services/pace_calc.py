"""Service for calculating running pace, time, and distance based on input parameters."""

def pace_from_distance_time(distance: float, total_seconds: int) -> int:
    """
    Calculate the pace in seconds per unit distance (mile or kilometer).

    Parameters:
        distance (float): The distance covered (in miles or kilometers).
        total_seconds (int): The total time taken in seconds.

    Returns:
        int: The pace rounded to the nearest second per unit distance.

    Example:
        >>> pace_from_distance_time(5.0, 1500)
        300
    """
    return int(round(total_seconds / distance))


def time_from_distance_pace(distance: float, pace_seconds_per_unit: int) -> int:
    """
    Calculate the total time in seconds given distance and pace.

    Parameters:
        distance (float): The distance to be covered (in miles or kilometers).
        pace_seconds_per_unit (int): The pace in seconds per unit distance.

    Returns:
        int: The total time in seconds rounded to the nearest integer.

    Example:
        >>> time_from_distance_pace(5.0, 300)
        1500
    """
    return int(round(distance * pace_seconds_per_unit))


def distance_from_time_pace(total_seconds: int, pace_seconds_per_unit: int) -> float:
    """
    Calculate the distance covered given total time and pace.

    Parameters:
        total_seconds (int): The total time in seconds.
        pace_seconds_per_unit (int): The pace in seconds per unit distance.

    Returns:
        float: The distance covered (in miles or kilometers).

    Example:
        >>> distance_from_time_pace(1500, 300)
        5.0
    """
    return total_seconds / pace_seconds_per_unit