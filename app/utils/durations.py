def parse_time_hhmmss(s: str) -> int:
    """
    Accept 'HH:MM:SS' or 'MM:SS' and return total seconds.
    Validates that minutes/seconds are 0–59 and format has 2 or 3 parts.
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
    """
    if seconds_per_unit < 0:
        raise ValueError("pace seconds must be >= 0")
    mm = seconds_per_unit // 60
    ss = seconds_per_unit % 60
    return f"{mm:02d}:{ss:02d}"