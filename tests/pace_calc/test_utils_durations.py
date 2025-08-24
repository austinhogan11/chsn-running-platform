# tests/pace_calc/test_utils_durations.py
import pytest
import app.utils.durations as d

# --- Bind the time helpers (these names have been stable)
parse_time_hhmmss = d.parse_time_hhmmss
format_time_hhmmss = d.format_time_hhmmss

# --- Find pace helpers under any of these common names
_parse_candidates = [
    "parse_pace_mmss_per_unit",
    "parse_pace_mmss_per_mile",
    "parse_pace_mmss",               # if you shortened it
]
_format_candidates = [
    "format_pace_mmss_per_unit",
    "format_pace_mmss_per_mile",
    "format_pace_mmss",              # if you shortened it
]

parse_pace = next((getattr(d, n) for n in _parse_candidates if hasattr(d, n)), None)
format_pace = next((getattr(d, n) for n in _format_candidates if hasattr(d, n)), None)

if parse_pace is None or format_pace is None:
    raise ImportError(
        "Could not find pace helpers in app.utils.durations. "
        f"Tried parse names: {_parse_candidates} and format names: {_format_candidates}."
    )

# ---------- TIME (HH:MM:SS) ----------

@pytest.mark.parametrize("time_str,seconds", [
    ("7:30",        450),      # MM:SS
    ("00:40:00",    2400),     # HH:MM:SS
    ("01:00:00",    3600),
    ("10:59:59",    39599),
    ("00:00:05",    5),
    ("0:05",        5),        # MM:SS with single-digit minutes
])
def test_parse_time_hhmmss_valid(time_str, seconds):
    assert parse_time_hhmmss(time_str) == seconds


@pytest.mark.parametrize("seconds,expected", [
    (0,        "00:00:00"),
    (5,        "00:00:05"),
    (75,       "00:01:15"),
    (2400,     "00:40:00"),
    (3600,     "01:00:00"),
    (39599,    "10:59:59"),
])
def test_format_time_hhmmss_valid(seconds, expected):
    assert format_time_hhmmss(seconds) == expected


@pytest.mark.parametrize("bad", [
    "7-30",          # wrong delimiter
    "abc",
    "99",            # missing colon(s)
    "1:2:3:4",       # too many parts
    "12:60:00",      # minutes out of range
    "00:00:60",      # seconds out of range
    "-01:00:00",     # negative hours not allowed
    "",              # empty
    ":::",           # nonsense
])
def test_parse_time_hhmmss_invalid(bad):
    with pytest.raises(Exception):
        parse_time_hhmmss(bad)


@pytest.mark.parametrize("neg", [-1, -60, -3600])
def test_format_time_hhmmss_rejects_negative(neg):
    with pytest.raises(ValueError):
        format_time_hhmmss(neg)


@pytest.mark.parametrize("seconds", [0, 1, 59, 60, 3599, 3600, 86399])
def test_time_roundtrip(seconds):
    """format -> parse should be identity for non-negative seconds."""
    s = format_time_hhmmss(seconds)
    assert parse_time_hhmmss(s) == seconds


# ---------- PACE (MM:SS per unit) ----------

@pytest.mark.parametrize("pace_str,seconds", [
    ("08:00", 480),
    ("07:30", 450),
    ("09:05", 545),
    ("00:00", 0),
    ("60:00", 3600),   # minutes may exceed 59; only seconds must be < 60
    ("0:59", 59),      # single-digit minutes allowed
])
def test_parse_pace_mmss_valid(pace_str, seconds):
    assert parse_pace(pace_str) == seconds


@pytest.mark.parametrize("seconds,expected", [
    (0,     "00:00"),
    (59,    "00:59"),
    (60,    "01:00"),
    (450,   "07:30"),
    (480,   "08:00"),
    (3600,  "60:00"),
])
def test_format_pace_mmss_valid(seconds, expected):
    assert format_pace(seconds) == expected


@pytest.mark.parametrize("bad", [
    "8m:00s",
    "8",
    "08-00",
    "07:99",     # invalid seconds
    ":",         # malformed
    "",          # empty
])
def test_parse_pace_mmss_invalid(bad):
    with pytest.raises(Exception):
        parse_pace(bad)


@pytest.mark.parametrize("neg", [-1, -60, -300])
def test_format_pace_mmss_rejects_negative(neg):
    with pytest.raises(ValueError):
        format_pace(neg)


@pytest.mark.parametrize("seconds", [0, 1, 59, 60, 299, 450, 480, 3600])
def test_pace_roundtrip(seconds):
    """format -> parse should be identity for non-negative pace seconds."""
    s = format_pace(seconds)
    assert parse_pace(s) == seconds