from app.services.pace import (
    pace_from_distance_time,
    time_from_distance_pace,
    distance_from_time_pace,
)

def test_pace_from_distance_time():
    assert pace_from_distance_time(5, 2400) == 480

def test_time_from_distance_pace():
    assert time_from_distance_pace(5, 480) == 2400

def test_distance_from_time_pace():
    assert distance_from_time_pace(2400, 480) == 5.0