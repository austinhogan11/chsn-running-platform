# tests/pace_calc/test_services_pace_calc.py
import math
import pytest
from app.services.pace_calc import (
    pace_from_distance_time,
    time_from_distance_pace,
    distance_from_time_pace,
)

# ---------- pace_from_distance_time ----------
def test_pace_from_distance_time_basic():
    # 40:00 over 5 units -> 8:00 per unit (480 sec)
    assert pace_from_distance_time(5.0, 2400) == 480
    # 60:00 over 13.1 units -> ~274.8 -> rounds to 275 (allow either side due to rounding)
    assert pace_from_distance_time(13.1, 3600) in (274, 275)

@pytest.mark.parametrize("distance, total_sec, expected_sec_per_unit", [
    (8.04672, 2400, 298),  # 2400 / 8.04672 ≈ 298.24 s per km
    (21.082,  3600, 171),  # 3600 / 21.082  ≈ 170.8  s per km
])
def test_pace_from_distance_time_param(distance, total_sec, expected_sec_per_unit):
    p = pace_from_distance_time(distance, total_sec)
    # allow off-by-one due to rounding to int
    assert p in (expected_sec_per_unit, expected_sec_per_unit + 1)

def test_pace_rounding_policy():
    # 4000 / 8.34 ≈ 479.86 sec -> 479 or 480 acceptable
    p = pace_from_distance_time(8.34, 4000)
    assert p in (479, 480)

def test_pace_from_distance_time_zero_distance_raises():
    # Document current behavior: Python will raise ZeroDivisionError
    with pytest.raises(ZeroDivisionError):
        pace_from_distance_time(0.0, 1000)

# ---------- time_from_distance_pace ----------
@pytest.mark.parametrize("distance, pace_sec, expected_total", [
    (5.0,     480, 2400),  # 5 * 480 = 2400
    (1.0,     300, 300),   # 1 * 300 = 300
    (8.04672, 480, 3862),  # 8.04672 * 480 = 3862.43 -> rounds to 3862
    (16.0934, 360, 5794),  # 16.0934 * 360 = 5793.62 -> rounds to 5794
])
def test_time_from_distance_pace(distance, pace_sec, expected_total):
    assert time_from_distance_pace(distance, pace_sec) == expected_total

def test_time_from_distance_pace_zero_distance_is_zero_time():
    # Document current behavior: 0 distance -> 0 total seconds
    assert time_from_distance_pace(0.0, 480) == 0

# ---------- distance_from_time_pace ----------
@pytest.mark.parametrize("total_sec, pace_sec, expected_distance", [
    (2400, 480, 5.0),
    (3600, 300, 12.0),
    (2400, 298, 2400 / 298),  # ≈ 8.05369
])
def test_distance_from_time_pace(total_sec, pace_sec, expected_distance):
    assert distance_from_time_pace(total_sec, pace_sec) == pytest.approx(expected_distance, rel=1e-6)

def test_distance_from_time_pace_zero_pace_raises():
    # Document current behavior: division by zero
    with pytest.raises(ZeroDivisionError):
        distance_from_time_pace(1000, 0)

# ---------- Round-trip consistency ----------
@pytest.mark.parametrize("distance, pace_sec", [
    (5.0, 480),
    (13.1, 275),
    (8.04672, 300),  # km-ish value
])
def test_round_trip_distance_pace_to_time_back_to_pace(distance, pace_sec):
    # distance + pace -> time -> pace (should recover original pace within 1s)
    total = time_from_distance_pace(distance, pace_sec)
    recovered_pace = pace_from_distance_time(distance, total)
    assert abs(recovered_pace - pace_sec) <= 1

@pytest.mark.parametrize("total_sec, pace_sec", [
    (2400, 480),
    (3600, 300),
    (753,  253),
])
def test_round_trip_time_pace_to_distance_back_to_time(total_sec, pace_sec):
    # time + pace -> distance -> time (should recover original time exactly under our rounding)
    dist = distance_from_time_pace(total_sec, pace_sec)
    recovered_total = time_from_distance_pace(dist, pace_sec)
    # Depending on rounding, allow 1-second tolerance
    assert abs(recovered_total - total_sec) <= 1

# ---------- Larger values smoke test ----------
def test_large_values_do_not_error():
    d = 1000.0
    p = 300  # 5:00 per unit
    total = time_from_distance_pace(d, p)
    assert total == int(round(d * p))
    # Back to distance:
    back_dist = distance_from_time_pace(total, p)
    assert back_dist == pytest.approx(d, rel=1e-9)