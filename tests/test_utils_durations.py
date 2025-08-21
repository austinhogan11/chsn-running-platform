import pytest
from app.utils.durations import (
    parse_time_hhmmss, format_time_hhmmss,
    parse_pace_mmss_per_mile, format_pace_mmss_per_mile,
)

# ---------- TIME (HH:MM:SS) ----------

@pytest.mark.parametrize("time_str,expected_seconds", [
    ("7:30", 450),          # MM:SS
    ("00:40:00", 2400),     # HH:MM:SS
    ("01:00:00", 3600),
    ("00:00:05", 5),
])
def test_parse_time_hhmmss(time_str, expected_seconds):
    assert parse_time_hhmmss(time_str) == expected_seconds


@pytest.mark.parametrize("seconds,expected_str", [
    (2400, "00:40:00"),
    (75,   "00:01:15"),
    (0,    "00:00:00"),
])
def test_format_time_hhmmss(seconds, expected_str):
    assert format_time_hhmmss(seconds) == expected_str


@pytest.mark.parametrize("bad_time_str", [
    "7-30",
    "abc",
    "99",        # missing colon
    "1:2:3:4",   # too many parts
])
def test_parse_time_hhmmss_invalid(bad_time_str):
    with pytest.raises(Exception):
        parse_time_hhmmss(bad_time_str)

# ---------- PACE (MM:SS per mile) ----------

@pytest.mark.parametrize("pace_str,expected_seconds", [
    ("08:00", 480),
    ("07:30", 450),
    ("09:05", 545),
])
def test_parse_pace_mmss_per_mile(pace_str, expected_seconds):
    assert parse_pace_mmss_per_mile(pace_str) == expected_seconds


@pytest.mark.parametrize("seconds_per_mile,expected_str", [
    (480, "08:00"),
    (450, "07:30"),
    (545, "09:05"),
])
def test_format_pace_mmss_per_mile(seconds_per_mile, expected_str):
    assert format_pace_mmss_per_mile(seconds_per_mile) == expected_str


@pytest.mark.parametrize("bad_pace_str", [
    "8m:00s",
    "8",
    "08-00",
    "07:99",     # invalid seconds
])
def test_parse_pace_mmss_per_mile_invalid(bad_pace_str):
    with pytest.raises(Exception):
        parse_pace_mmss_per_mile(bad_pace_str)

