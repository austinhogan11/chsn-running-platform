import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# ---------- VALID CASES ----------

@pytest.mark.parametrize("params, expected", [
    ({"distance": 5, "time": "00:40:00"},
     {"distance": 5, "time": "00:40:00", "pace": "08:00"}),

    ({"distance": 5, "pace": "08:00"},
     {"distance": 5, "time": "00:40:00", "pace": "08:00"}),

    ({"time": "00:40:00", "pace": "08:00"},
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
    {"distance": 5, "pace": "8m:00s"},          # bad pace format
    {"time": "7-30", "pace": "08:00"},          # bad time format
    {"time": "00:40:00", "pace": "07:99"},      # invalid seconds
])
def test_invalid_string_inputs(params):
    r = client.get("/pace-calc", params=params)
    # depending on your parsing, FastAPI may return 400 or validation 422
    assert r.status_code in (400, 422)
