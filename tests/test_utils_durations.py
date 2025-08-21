from app.utils.durations import (
    parse_time_hhmmss, format_time_hhmmss,
    parse_pace_mmss_per_mile, format_pace_mmss_per_mile,
)

def test_parse_time_hhmmss():
    assert parse_time_hhmmss("00:40:00") == 2400
    assert parse_time_hhmmss("7:30") == 450

def test_format_time_hhmmss():
    assert format_time_hhmmss(2400) == "00:40:00"
    assert format_time_hhmmss(450) == "00:07:30"

def test_parse_pace():
    assert parse_pace_mmss_per_mile("08:00") == 480

def test_format_pace():
    assert format_pace_mmss_per_mile(450) == "07:30"