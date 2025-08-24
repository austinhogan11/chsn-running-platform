import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# ---------- VALID CASES ----------

@pytest.mark.parametrize("params, expected", [
    # Miles (mi, default)
    ({"distance": 5, "time": "00:40:00", "unit": "mi"},
     {"distance": 5, "time": "00:40:00", "pace": "08:00"}),

    ({"distance": 5, "pace": "08:00", "unit": "mi"},
     {"distance": 5, "time": "00:40:00", "pace": "08:00"}),

    ({"time": "00:40:00", "pace": "08:00", "unit": "mi"},
     {"distance": 5.0, "time": "00:40:00", "pace": "08:00"}),

    # Kilometers
    ({"distance": 5, "time": "00:40:00", "unit": "km"},
     {"distance": 5, "time": "00:40:00", "pace": "08:00"}),

    ({"distance": 5, "pace": "08:00", "unit": "km"},
     {"distance": 5, "time": "00:40:00", "pace": "08:00"}),

    ({"time": "00:40:00", "pace": "08:00", "unit": "km"},
     {"distance": 5.0, "time": "00:40:00", "pace": "08:00"}),
])
def test_pace_calc_valid(params, expected):
    r = client.get("/pace-calc", params=params)
    assert r.status_code == 200
    data = r.json()
    # compare only fields present in expected to avoid float formatting surprises
    for k, v in expected.items():
        assert data[k] == v


# ---------- INVALID CASES ----------

@pytest.mark.parametrize("params", [
    {"distance": 5},  # only one param
    {"time": "00:40:00"},  # only one
    {"pace": "08:00"},  # only one
    {"distance": 5, "time": "00:40:00", "pace": "08:00"},  # all three
])
def test_requires_exactly_two_params(params):
    r = client.get("/pace-calc", params=params)
    assert r.status_code == 400

@pytest.mark.parametrize("params", [
    {"distance": 5, "time": "00:40:00", "unit": "yards"},
    {"distance": 5, "pace": "08:00", "unit": "minutes"},
    {"time": "00:40:00", "pace": "08:00", "unit": "milez"},
])
def test_invalid_unit_rejected_by_validation(params):
    r = client.get("/pace-calc", params=params)
    assert r.status_code == 422


@pytest.mark.parametrize("params", [
    {"distance": 5, "pace": "8m:00s"},          # bad pace format
    {"time": "7-30", "pace": "08:00"},          # bad time format
    {"time": "00:40:00", "pace": "07:99"},      # invalid seconds
    # Bad unit value
    {"distance": 5, "time": "00:40:00", "unit": "parsecs"},
    {"distance": 5, "pace": "08:00", "unit": "lightyears"},
])
def test_invalid_string_inputs(params):
    r = client.get("/pace-calc", params=params)
    # depending on your parsing, FastAPI may return 400 or validation 422
    assert r.status_code in (400, 422)


# ---------- ADDITIONAL BEHAVIOR / CONTRACT TESTS ----------

def test_defaults_to_mi_unit_when_omitted():
    """If unit is not provided, API should default to 'mi' and return expected values."""
    r = client.get("/pace-calc", params={"distance": 5, "time": "00:40:00"})
    assert r.status_code == 200
    data = r.json()
    assert data["unit"] == "mi"
    assert data["distance"] == 5
    assert data["time"] == "00:40:00"
    assert data["pace"] == "08:00"

def test_response_shape_and_types():
    """Response should contain canonical keys and expected types/formatting."""
    r = client.get("/pace-calc", params={"distance": 10, "pace": "07:30", "unit": "mi"})
    assert r.status_code == 200
    data = r.json()
    # Keys present
    for k in ("distance", "time", "pace", "unit"):
        assert k in data
    # Types / formats
    assert isinstance(data["distance"], (int, float))
    assert isinstance(data["time"], str) and len(data["time"].split(":")) in (2,3)
    assert isinstance(data["pace"], str) and len(data["pace"].split(":")) == 2
    assert data["unit"] in ("mi", "km")

def test_accepts_mmss_time_without_hours():
    """MM:SS time should be accepted and interpreted as 00:MM:SS."""
    r = client.get("/pace-calc", params={"distance": 5, "time": "40:00", "unit": "mi"})
    assert r.status_code == 200
    data = r.json()
    # 40:00 for 5 miles => 08:00/mi
    assert data["pace"] == "08:00"

@pytest.mark.parametrize("time_str, pace_str, expected_distance", [
    # 40:00 at 07:30 => 2400 / 450 = 5.333... -> 5.33 with API rounding
    ("00:40:00", "07:30", 5.33),
    # 1:05:00 at 08:20 => 3900 / 500 = 7.8 -> 7.80 (ensure trailing zero kept by JSON float)
    ("01:05:00", "08:20", 7.8),
])
def test_distance_rounding_two_decimals(time_str, pace_str, expected_distance):
    r = client.get("/pace-calc", params={"time": time_str, "pace": pace_str, "unit": "mi"})
    assert r.status_code == 200
    data = r.json()
    # Compare with tolerance rather than strict string formatting since JSON returns a number
    assert abs(float(data["distance"]) - expected_distance) < 0.01

def test_km_rounding_and_unit_echo():
    """Ensure km unit round-trip and rounding behavior."""
    # 10 km in 50:00 => 5:00 per km
    r = client.get("/pace-calc", params={"distance": 10, "time": "00:50:00", "unit": "km"})
    assert r.status_code == 200
    data = r.json()
    assert data["unit"] == "km"
    assert data["pace"] == "05:00"
    assert data["distance"] == 10
