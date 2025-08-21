from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_distance_time_returns_pace():
    resp = client.get("/pace-calc", params={"distance": 5, "time": "00:40:00"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["pace"] == "08:00"
    assert data["distance"] == 5
    assert data["time"] == "00:40:00"

def test_distance_pace_returns_time():
    resp = client.get("/pace-calc", params={"distance": 5, "pace": "08:00"})
    assert resp.status_code == 200
    assert resp.json()["time"] == "00:40:00"

def test_time_pace_returns_distance():
    resp = client.get("/pace-calc", params={"time": "00:40:00", "pace": "08:00"})
    assert resp.status_code == 200
    assert resp.json()["distance"] == 5.0

def test_requires_exactly_two_params():
    resp = client.get("/pace-calc", params={"distance": 5})
    assert resp.status_code == 400