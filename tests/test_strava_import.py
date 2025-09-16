import json
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import app


class _Resp:
    def __init__(self, status_code: int, payload: dict):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload

    @property
    def text(self):
        return json.dumps(self._payload)


class _DummyClient:
    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url: str, headers=None, params=None):
        # Simulate Strava responses
        if url.endswith("/streams"):
            return _Resp(200, {"latlng": {"data": [[0.0, 0.0], [0.1, 0.1]]}})
        else:
            return _Resp(200, {
                "distance": 5000.0,  # meters
                "moving_time": 1500,
                "name": "Mock Run",
                "description": "",
                "start_date": datetime.now(timezone.utc).isoformat(),
                "total_elevation_gain": 30.0,
            })


@pytest.fixture(autouse=True)
def patch_httpx(monkeypatch):
    import httpx

    monkeypatch.setattr(httpx, "AsyncClient", _DummyClient)


def test_import_from_strava(monkeypatch):
    # Skip real token lookup
    from app.api import strava as strava_api

    async def fake_token(_):
        return "fake"

    monkeypatch.setattr(strava_api, "_ensure_token", fake_token)
    monkeypatch.setattr(strava_api, "_resolve_athlete_id", lambda x: 1)

    client = TestClient(app)

    payload = {"activity_id": 1234567890, "unit": "mi"}
    r = client.post("/runs/from-strava", json=payload)
    assert r.status_code == 201
    data = r.json()
    assert data["source"] == "strava"
    assert data["source_ref"] == str(payload["activity_id"])
    assert data["distance"] > 0
    assert data["duration_s"] > 0

