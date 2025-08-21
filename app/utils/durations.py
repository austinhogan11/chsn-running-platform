def parse_time_hhmmss(s: str) -> int:
    """
    Convert 'HH:MM:SS' or 'MM:SS' into total seconds (int).
    Examples:
      '00:40:00' -> 2400
      '7:30'     -> 450
    """
    split_s = s.split(":")
    if len(split_s) == 3:
        return (int(split_s[0]) * 3600) + (int(split_s[1]) * 60) + int(split_s[2])
    return (int(split_s[0]) * 60) + int(split_s[1])


def format_time_hhmmss(seconds: int) -> str:
    """
    Convert total seconds into 'HH:MM:SS'.
    Example:
      2400 -> '00:40:00'
    """
    hh = int(seconds / 3600)
    seconds = seconds % 3600
    mm = int(seconds / 60)
    seconds = seconds % 60
    return f"{hh:02d}:{mm:02d}:{seconds:02d}"


print(parse_time_hhmmss("00:40:00"))
print(parse_time_hhmmss("7:30"))
print(format_time_hhmmss(2400))


