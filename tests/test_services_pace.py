# tests/test_services_pace.py
import pytest
from app.services.pace import (
    pace_from_distance_time,
    time_from_distance_pace,
    distance_from_time_pace,
)

# tests/test_services_pace.py
import pytest
from app.services.pace import (
    pace_from_distance_time,
    time_from_distance_pace,
    distance_from_time_pace,
)

# ---------- pace_from_distance_time ----------
def test_pace_from_distance_time_basic():
    # 40:00 over 5 units -> 8:00 per unit (480 sec)
    assert pace_from_distance_time(5.0, 2400) == 480
    # 60:00 over 13.1 units -> ~274.8 -> rounds to 275 (allow either side)
    assert pace_from_distance_time(13.1, 3600) in (274, 275)

@pytest.mark.parametrize("distance, total_sec, expected_sec_per_unit", [
    (8.04672, 2400, 298),   # 2400 / 8.04672 ≈ 298.24 s per km
    (21.082,  3600, 171),   # 3600 / 21.082  ≈ 170.8  s per km
])
def test_pace_from_distance_time_km(distance, total_sec, expected_sec_per_unit):
    p = pace_from_distance_time(distance, total_sec)
    assert p in (expected_sec_per_unit, expected_sec_per_unit + 1)

# ---------- time_from_distance_pace ----------
@pytest.mark.parametrize("distance, pace_sec, expected_total", [
    (5.0,     480, 2400),   # 5 * 480 = 2400
    (1.0,     300, 300),    # 1 * 300 = 300
    (8.04672, 480, 3862),   # 8.04672 * 480 = 3862.43 -> rounds to 3862
    (16.0934, 360, 5794),   # 16.0934 * 360 = 5793.62 -> rounds to 5794
])
def test_time_from_distance_pace(distance, pace_sec, expected_total):
    assert time_from_distance_pace(distance, pace_sec) == expected_total

# ---------- distance_from_time_pace ----------
@pytest.mark.parametrize("total_sec, pace_sec, expected_distance", [
    (2400, 480, 5.0),
    (3600, 300, 12.0),
    (2400, 298, 2400 / 298),  # ≈ 8.05369
])
def test_distance_from_time_pace(total_sec, pace_sec, expected_distance):
    assert distance_from_time_pace(total_sec, pace_sec) == pytest.approx(expected_distance, rel=1e-6)

# ---------- rounding behavior ----------
def test_pace_rounding_policy():
    # 4000 / 8.34 ≈ 479.86 sec -> 479 or 480 acceptable by rounding policy
    p = pace_from_distance_time(8.34, 4000)
    assert p in (479, 480)
