"""Helper functions for parsing and formatting time and pace values."""

def parse_time_hhmmss(s: str) -> int:
    """
    Accept 'HH:MM:SS' or 'MM:SS' and return total seconds.
    Validates that minutes/seconds are 0–59 and format has 2 or 3 parts.

    Examples:
        parse_time_hhmmss("12:34") -> 754
        parse_time_hhmmss("01:02:03") -> 3723
    """
    parts = s.split(":")
    if len(parts) == 2:
        mm, ss = parts
        mm, ss = int(mm), int(ss)
        if not (0 <= mm and 0 <= ss < 60):
            raise ValueError("Invalid MM:SS values")
        return mm * 60 + ss
    elif len(parts) == 3:
        hh, mm, ss = parts
        hh, mm, ss = int(hh), int(mm), int(ss)
        if not (0 <= mm < 60 and 0 <= ss < 60 and hh >= 0):
            raise ValueError("Invalid HH:MM:SS values")
        return hh * 3600 + mm * 60 + ss
    else:
        raise ValueError("Invalid time format (expected MM:SS or HH:MM:SS)")


def format_time_hhmmss(seconds: int) -> str:
    """
    Format a duration given in total seconds into 'HH:MM:SS' string format.

    Parameters:
        seconds (int): Total number of seconds (must be >= 0).

    Returns:
        str: Formatted time string in 'HH:MM:SS' format, with zero-padded fields.

    Examples:
        format_time_hhmmss(754) -> "00:12:34"
        format_time_hhmmss(3723) -> "01:02:03"
    """
    if seconds < 0:
        raise ValueError("seconds must be >= 0")
    hh = seconds // 3600
    seconds %= 3600
    mm = seconds // 60
    ss = seconds % 60
    return f"{hh:02d}:{mm:02d}:{ss:02d}"


def parse_pace_mmss(s: str) -> int:
    """
    Accept 'MM:SS' pace; validate seconds 0–59.
    Returns total seconds per unit.

    Examples:
        parse_pace_mmss("05:30") -> 330
        parse_pace_mmss("00:45") -> 45
    """
    parts = s.split(":")
    if len(parts) != 2:
        raise ValueError("Invalid pace format (expected MM:SS)")
    mm, ss = int(parts[0]), int(parts[1])
    if not (0 <= mm and 0 <= ss < 60):
        raise ValueError("Invalid pace values")
    return mm * 60 + ss


def format_pace_mmss(seconds_per_unit: int) -> str:
    """
    Format pace seconds per unit as 'MM:SS'.

    Parameters:
        seconds_per_unit (int): Pace in total seconds per unit (must be >= 0).

    Returns:
        str: Formatted pace string in 'MM:SS' format, zero-padded.

    Examples:
        format_pace_mmss(330) -> "05:30"
        format_pace_mmss(45) -> "00:45"
    """
    if seconds_per_unit < 0:
        raise ValueError("pace seconds must be >= 0")
    mm = seconds_per_unit // 60
    ss = seconds_per_unit % 60
    return f"{mm:02d}:{ss:02d}"