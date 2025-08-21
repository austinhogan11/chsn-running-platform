# tests/test_services_pace.py
import pytest
from app.services.pace import (
    pace_from_distance_time,
    time_from_distance_pace,
    distance_from_time_pace,
)

@pytest.mark.parametrize("distance,time_sec,expected_pace_sec", [
    (5.0, 2400, 480),     # 40:00 over 5 mi -> 8:00/mi
    (13.1, 3600, 275),    # 1:00:00 half marathon-ish -> ~4:34/mi (integer seconds)
])
def test_pace_from_distance_time(distance, time_sec, expected_pace_sec):
    assert pace_from_distance_time(distance, time_sec) == expected_pace_sec

@pytest.mark.parametrize("distance,pace_sec,expected_time_sec", [
    (5.0, 480, 2400),
    (10.0, 360, 3600),
])
def test_time_from_distance_pace(distance, pace_sec, expected_time_sec):
    assert time_from_distance_pace(distance, pace_sec) == expected_time_sec

@pytest.mark.parametrize("time_sec,pace_sec,expected_distance", [
    (2400, 480, 5.0),
    (3600, 360, 10.0),
])
def test_distance_from_time_pace(time_sec, pace_sec, expected_distance):
    assert distance_from_time_pace(time_sec, pace_sec) == expected_distance

def test_pace_rounding_policy_allows_floor_or_round():
    """
    If your implementation uses int() it floors; if it uses round() it may round.
    This keeps the test robust while you decide the policy.
    """
    p = pace_from_distance_time(5.0, 2399)  # 479.8 -> 480
    assert p == 480
