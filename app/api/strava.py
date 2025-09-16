from __future__ import annotations
"""Strava OAuth + Activity API integration (minimal, documented).

This module wires the Strava connect flow and a couple of lightweight
activity endpoints. It is intentionally small and self‑contained so we can
ship value fast and evolve later (DB storage, webhooks, caching, etc.).

Endpoints
---------
GET  /api/strava/connect
    Redirects to Strava OAuth. Sets a CSRF `state` cookie.

GET  /api/strava/oauth/callback
    Handles the redirect back from Strava. Exchanges `code` for tokens and
    stores them (in‑memory for dev). Returns a tiny JSON payload with the
    connected athlete.

GET  /api/strava/me?athlete_id=...
    Debug helper: fetch the authenticated athlete profile.

GET  /api/strava/activities?athlete_id=...&page=1&per_page=30&after=YYYY-MM-DD
    Lists recent activities (proxied from Strava) with a trimmed set of fields
    suitable for a picker UI (id, name, date, distance, moving_time, type).

GET  /api/strava/activities/{id}/preview?athlete_id=...
    Fetches activity detail + streams and returns a normalized preview JSON
    (summary, polyline, downsampled series, mile splits) compatible with the
    GPX preview UI.

Notes
-----
- Tokens are kept in a simple in‑memory dictionary for development. Replace
  `_TOKEN_STORE` with a real DB table keyed by your CHSN user id in prod.
- We keep scopes minimal: `read, activity:read`. Add `activity:read_all` only
  if you truly need private activities.
- We request streams keys: `latlng,time,velocity_smooth,heartrate,altitude`.
  These map cleanly to your UI's series (pace/hr/elev) and a route polyline.
"""

import os
import time
import uuid
import asyncio
from datetime import datetime
from typing import Any, Dict, Optional, List

import httpx
from fastapi import APIRouter, HTTPException, Request, Query, Body
from fastapi.responses import RedirectResponse, JSONResponse
from app.settings import settings

router = APIRouter(prefix="/api/strava", tags=["strava"])

# --- Units ---
M_PER_MI = 1609.344
FT_PER_M = 3.28084

# --- Config helpers ---
CLIENT_ID = settings.STRAVA_CLIENT_ID or os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = settings.STRAVA_CLIENT_SECRET or os.getenv("STRAVA_CLIENT_SECRET")
BASE_URL = settings.BASE_URL or os.getenv("BASE_URL", "http://localhost:8000")
CALLBACK_PATH = "/api/strava/oauth/callback"
CALLBACK_URL = f"{BASE_URL.rstrip('/')}{CALLBACK_PATH}"

# Scopes: start minimal; add `activity:read_all` later if you truly need private activities
SCOPES = ["read", "activity:read"]

# Simple in-memory token store for development.
# TODO: replace with a proper DB table keyed by your CHSN user id
#   Fields: strava_athlete_id, access_token, refresh_token, expires_at
_TOKEN_STORE: Dict[int, Dict[str, Any]] = {}

# Short‑lived OAuth state store (dev helper in case cookies don't round‑trip)
_OAUTH_STATES: set[str] = set()


def _resolve_athlete_id(maybe_id: Optional[int]) -> int:
    """If an athlete_id is provided, return it; otherwise, if exactly one
    athlete is connected (dev flow), return that one. Otherwise error."""
    if maybe_id is not None:
        return int(maybe_id)
    if len(_TOKEN_STORE) == 1:
        return next(iter(_TOKEN_STORE.keys()))
    raise HTTPException(status_code=400, detail="athlete_id is required")


# ========== OAuth ==========
@router.get("/connect")
async def connect(request: Request) -> RedirectResponse:
    """Start Strava OAuth by redirecting the user to Strava's authorize screen.

    Sets a CSRF `state` cookie and includes it in the authorize URL.
    """
    if not CLIENT_ID or not CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Missing STRAVA_CLIENT_ID/SECRET env vars")

    state = uuid.uuid4().hex
    scope = ",".join(SCOPES)

    # Build callback URL from the incoming request to avoid localhost/127.0.0.1 mismatches
    base_from_req = f"{request.url.scheme}://{request.url.netloc}"
    callback_url = f"{base_from_req}{CALLBACK_PATH}"

    # Track state in memory as a fallback (cleared on callback)
    _OAUTH_STATES.add(state)

    auth_url = (
        "https://www.strava.com/oauth/authorize"
        f"?client_id={CLIENT_ID}"
        f"&redirect_uri={callback_url}"
        "&response_type=code"
        f"&scope={scope}"
        "&approval_prompt=auto"
        f"&state={state}"
    )
    resp = RedirectResponse(auth_url, status_code=302)
    # Lax is fine for same-site dev; tighten to 'Strict' in prod if desired
    resp.set_cookie(
        "strava_oauth_state",
        state,
        max_age=600,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return resp

# ========== Lightweight Route for Map Rendering ==========

@router.get("/activities/{activity_id}/route")
async def activity_route(athlete_id: Optional[int] = None, activity_id: int = 0):
    """Return only the GPS route for an activity (small payload for map rendering).

    Response shape:
    {
      "polyline": [[lat, lng], ...],
      "bounds": {"min_lat": .., "min_lng": .., "max_lat": .., "max_lng": ..}
    }
    """
    athlete_id = _resolve_athlete_id(athlete_id)
    token = await _ensure_token(athlete_id)
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=20) as client:
        streams_r = await client.get(
            f"https://www.strava.com/api/v3/activities/{activity_id}/streams",
            headers=headers,
            params={
                "keys": "latlng",
                "key_by_type": "true",
            },
        )

    if streams_r.status_code != 200:
        raise HTTPException(status_code=502, detail={"reason": "route_failed", "streams_status": streams_r.status_code})

    streams = streams_r.json() or {}
    latlng = streams.get("latlng", {}).get("data", [])

    # Compute simple bounds for convenience
    if latlng:
        lats = [p[0] for p in latlng]
        lngs = [p[1] for p in latlng]
        bounds = {
            "min_lat": min(lats),
            "min_lng": min(lngs),
            "max_lat": max(lats),
            "max_lng": max(lngs),
        }
    else:
        bounds = None

    return JSONResponse({"polyline": latlng, "bounds": bounds})


@router.get("/oauth/callback")
async def oauth_callback(
    request: Request,
    code: Optional[str] = None,
    scope: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
):
    """Handle Strava OAuth callback: exchange `code` for tokens and store them.

    Returns a lightweight JSON payload. Frontend can redirect user back to the Training Log.
    """
    if error:
        raise HTTPException(status_code=400, detail=f"Strava error: {error}")
    if not code:
        raise HTTPException(status_code=400, detail="Missing code")

    # CSRF state check
    cookie_state = request.cookies.get("strava_oauth_state")
    valid = (cookie_state and state and cookie_state == state) or (state in _OAUTH_STATES)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid or missing OAuth state")
    # one‑time use
    if state:
        _OAUTH_STATES.discard(state)

    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post("https://www.strava.com/api/v3/oauth/token", data=data)
        if r.status_code != 200:
            # Forward a readable error to the client
            try:
                detail = r.json()
            except Exception:
                detail = r.text
            raise HTTPException(status_code=502, detail={"reason": "token_exchange_failed", "upstream": detail})
        token = r.json()

    access_token = token.get("access_token")
    refresh_token = token.get("refresh_token")
    expires_at = token.get("expires_at")  # epoch seconds
    athlete = token.get("athlete") or {}
    athlete_id = athlete.get("id")

    if not all([access_token, refresh_token, expires_at, athlete_id]):
        raise HTTPException(status_code=502, detail="Incomplete token response from Strava")

    # Store in dev token store. Replace with DB write tied to your signed-in CHSN user.
    _TOKEN_STORE[int(athlete_id)] = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_at": int(expires_at),
        "athlete": athlete,
    }

    # On success, redirect back to the Training Log UI
    redirect_to = "/static/index.html?view=training-log&strava=connected"
    resp = RedirectResponse(url=redirect_to, status_code=302)
    resp.delete_cookie("strava_oauth_state")
    _OAUTH_STATES.discard(state or "")
    return resp


async def _ensure_token(athlete_id: int) -> str:
    """Get a valid access token for the athlete, refreshing if needed."""
    rec = _TOKEN_STORE.get(int(athlete_id))
    if not rec:
        raise HTTPException(status_code=401, detail="No Strava token on file for this athlete")

    now = int(time.time())
    if rec["expires_at"] - now > 60:  # still valid with 1‑min buffer
        return rec["access_token"]

    # Refresh
    payload = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": rec["refresh_token"],
    }
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post("https://www.strava.com/api/v3/oauth/token", data=payload)
        if r.status_code != 200:
            try:
                detail = r.json()
            except Exception:
                detail = r.text
            raise HTTPException(status_code=502, detail={"reason": "token_refresh_failed", "upstream": detail})
        token = r.json()

    rec.update(
        {
            "access_token": token.get("access_token", rec["access_token"]),
            "refresh_token": token.get("refresh_token", rec["refresh_token"]),
            "expires_at": int(token.get("expires_at", rec["expires_at"]))
        }
    )
    return rec["access_token"]


# ========== Debug ==========
@router.get("/me")
async def whoami(athlete_id: Optional[int] = None):
    """Simple debug endpoint to verify tokens (dev only).

    Call with the athlete_id you just connected; returns Strava athlete profile.
    """
    athlete_id = _resolve_athlete_id(athlete_id)
    token = await _ensure_token(athlete_id)
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get("https://www.strava.com/api/v3/athlete", headers=headers)
    return JSONResponse(r.json())


@router.get("/status")
async def status(athlete_id: Optional[int] = None):
    """Return connection status for Strava (dev-friendly).

    If `athlete_id` is omitted and exactly one athlete is connected, returns that one.
    """
    try:
        aid = _resolve_athlete_id(athlete_id)
    except HTTPException as e:
        # Return empty status instead of error to simplify front-end checks
        if e.status_code == 400:
            return JSONResponse({"connected": False})
        raise
    rec = _TOKEN_STORE.get(aid)
    if not rec:
        return JSONResponse({"connected": False})
    athlete = rec.get("athlete", {})
    return JSONResponse({
        "connected": True,
        "athlete_id": aid,
        "athlete": {"firstname": athlete.get("firstname"), "lastname": athlete.get("lastname")},
        "expires_at": rec.get("expires_at"),
    })


# ========== Activities ==========
@router.get("/activities")
async def list_activities(
    athlete_id: Optional[int] = None,
    page: int = Query(1, ge=1, le=200),
    per_page: int = Query(30, ge=1, le=200),
    after: Optional[str] = Query(None, description="ISO date, e.g., 2024-01-01"),
    activity_type: str = Query("Run", description="Activity type to filter, default Run"),
):
    """List recent activities for the connected athlete (trimmed fields).

    Parameters
    ----------
    athlete_id : int
        Strava athlete id returned from the OAuth callback.
    page, per_page : int
        Pagination forwarded to Strava.
    after : str, optional
        ISO date; when provided we convert to epoch and pass to Strava `after`.
    """
    athlete_id = _resolve_athlete_id(athlete_id)
    token = await _ensure_token(athlete_id)
    headers = {"Authorization": f"Bearer {token}"}
    params: Dict[str, Any] = {"page": page, "per_page": per_page}
    if after:
        try:
            dt = datetime.fromisoformat(after)
            params["after"] = int(dt.timestamp())
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid 'after' date; use YYYY-MM-DD")

    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get("https://www.strava.com/api/v3/athlete/activities", headers=headers, params=params)
    if r.status_code != 200:
        try:
            detail = r.json()
        except Exception:
            detail = r.text
        raise HTTPException(status_code=502, detail={"reason": "list_failed", "upstream": detail})

    items = r.json()
    if activity_type:
        items = [it for it in items if (it.get("type") or "").lower() == activity_type.lower()]
    # Trim for UI list
    out = [
        {
            "id": it.get("id"),
            "name": it.get("name"),
            "type": it.get("type"),
            "start_date": it.get("start_date_local") or it.get("start_date"),
            "distance_mi": round((it.get("distance") or 0) / M_PER_MI, 2),
            "moving_time_s": it.get("moving_time"),
        }
        for it in items
    ]
    return JSONResponse(out)


@router.get("/activities/{activity_id}/preview")
async def preview_activity(athlete_id: Optional[int] = None, activity_id: int = 0):
    """Return a normalized preview for one activity.

    We fetch:
      - Activity detail (distance, moving_time, elevation gain, splits)
      - Streams keyed by type (latlng, time, velocity_smooth, heartrate, altitude)
    and map them to your preview JSON used by the GPX importer.
    """
    athlete_id = _resolve_athlete_id(athlete_id)
    token = await _ensure_token(athlete_id)
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=30) as client:
        detail_r, streams_r = await asyncio.gather(
            client.get(
                f"https://www.strava.com/api/v3/activities/{activity_id}",
                headers=headers,
                params={"include_all_efforts": "false"},
            ),
            client.get(
                f"https://www.strava.com/api/v3/activities/{activity_id}/streams",
                headers=headers,
                params={
                    "keys": "latlng,time,velocity_smooth,heartrate,altitude",
                    "key_by_type": "true",
                },
            ),
        )

    if detail_r.status_code != 200 or streams_r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail={
                "reason": "preview_failed",
                "detail_status": detail_r.status_code,
                "streams_status": streams_r.status_code,
            },
        )

    detail = detail_r.json()
    streams = streams_r.json()  # key_by_type=true shape

    # Summary
    distance_mi = (detail.get("distance") or 0) / M_PER_MI
    moving_time_s = detail.get("moving_time")
    elev_gain_ft = (detail.get("total_elevation_gain") or 0) * FT_PER_M
    avg_hr = detail.get("average_heartrate")

    # Series (downsample on the client later if needed)
    t_s = streams.get("time", {}).get("data", [])
    v = streams.get("velocity_smooth", {}).get("data", [])
    pace_s_per_mi = [(M_PER_MI / s) if s and s > 0 else None for s in v]
    hr_bpm = streams.get("heartrate", {}).get("data", [])
    elev_ft = [(e or 0) * FT_PER_M for e in streams.get("altitude", {}).get("data", [])]

    # Polyline as lat/lon pairs
    latlng = streams.get("latlng", {}).get("data", [])  # [[lat, lng], ...]

    # Splits (standard miles if available)
    splits = detail.get("splits_standard") or []
    mile_splits = [
        {
            "mile": i + 1,
            "time_s": s.get("moving_time") or s.get("elapsed_time"),
            "pace_s_per_mi": (M_PER_MI / (s.get("average_speed") or 0)) if s.get("average_speed") else None,
            "avg_hr": s.get("average_heartrate"),
        }
        for i, s in enumerate(splits)
        if abs((s.get("distance") or 0) - M_PER_MI) < 50  # filter near‑mile entries
    ]

    preview = {
        "summary": {
            "distance_mi": distance_mi,
            "duration_s": moving_time_s,
            "avg_pace_s_per_mi": (moving_time_s / distance_mi) if moving_time_s and distance_mi else None,
            "avg_hr": avg_hr,
            "elev_gain_ft": elev_gain_ft,
        },
        "polyline": latlng,
        "series": {
            "t_s": t_s,
            "pace_s_per_mi": pace_s_per_mi,
            "hr_bpm": hr_bpm,
            "elev_ft": elev_ft,
        },
        "auto_mile_splits": mile_splits,
        "segments": [],  # could map laps/intervals later
    }
    return JSONResponse(preview)


# ========== Bulk Sync ==========
@router.post("/sync")
async def sync_all_runs(
    request: Request,
    athlete_id: Optional[int] = None,
    after: Optional[str] = Query(None, description="ISO date, only import activities after this date"),
    max_import: int = Query(200, ge=1, le=2000, description="Max number of activities to import"),
    dry_run: bool = Query(False, description="If true, does not create runs; returns what would be imported"),
):
    """Bulk-sync Strava **Run** activities into CHSN runs.

    Strategy (safe-by-default):
    - Paginates through `/athlete/activities` (filtering to Runs).
    - Consider an activity already imported if there's an existing run on the same
      local day with distance within 0.02 mi and moving time within 10s.
      (Heuristic until we add a `source_ref` field on runs.)
    - For items that look new, call `POST /runs/from-strava` (unless `dry_run=true`).

    Returns summary counts and IDs.
    """
    # Resolve athlete and token
    athlete_id = _resolve_athlete_id(athlete_id)
    token = await _ensure_token(athlete_id)

    # Base URL for local calls (handles localhost vs 127.0.0.1)
    base_from_req = f"{request.url.scheme}://{request.url.netloc}"

    # Load existing runs to avoid duplicates
    existing_keyset = set()
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(f"{base_from_req}/runs")
            r.raise_for_status()
            existing = r.json()
            for run in existing:
                dt = run.get("started_at")
                if not dt:
                    continue
                day = dt.split("T", 1)[0]
                dist = float(run.get("distance") or 0.0)
                # round to 0.02 mi buckets (~105 ft)
                dist_key = round(dist / 0.02) * 0.02
                dur = int(run.get("duration_s") or 0)
                dur_key = round(dur / 10) * 10
                existing_keyset.add((day, dist_key, dur_key))
    except Exception:
        existing_keyset = set()

    headers = {"Authorization": f"Bearer {token}"}

    def day_key(iso: str) -> str:
        try:
            return (iso or "").split("T", 1)[0]
        except Exception:
            return ""

    params_base: Dict[str, Any] = {"per_page": 50}
    if after:
        try:
            dt = datetime.fromisoformat(after)
            params_base["after"] = int(dt.timestamp())
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid 'after' date; use YYYY-MM-DD")

    imported: List[int] = []
    skipped: List[int] = []
    already: List[int] = []
    errors: List[Dict[str, Any]] = []

    remaining = max_import
    page = 1

    async with httpx.AsyncClient(timeout=30) as client:
        while remaining > 0:
            params = dict(params_base)
            params.update({"page": page})
            resp = await client.get("https://www.strava.com/api/v3/athlete/activities", headers=headers, params=params)
            if resp.status_code != 200:
                break
            items = resp.json() or []
            if not items:
                break

            for it in items:
                if remaining <= 0:
                    break
                if (it.get("type") or "").lower() != "run":
                    continue

                day = day_key(it.get("start_date_local") or it.get("start_date"))
                dist_key = round(((it.get("distance") or 0) / M_PER_MI) / 0.02) * 0.02
                dur_key = round(int(it.get("moving_time") or 0) / 10) * 10
                key = (day, dist_key, dur_key)
                if key in existing_keyset:
                    already.append(it.get("id"))
                    continue

                if dry_run:
                    skipped.append(it.get("id"))  # would import
                    remaining -= 1
                else:
                    try:
                        cr = await client.post(
                            f"{base_from_req}/runs/from-strava",
                            json={"activity_id": it.get("id")},
                            headers={"Content-Type": "application/json"},
                        )
                        if cr.status_code in (200, 201):
                            imported.append(it.get("id"))
                            existing_keyset.add(key)
                            remaining -= 1
                        else:
                            errors.append({
                                "activity_id": it.get("id"),
                                "status": cr.status_code,
                                "detail": cr.text,
                            })
                            remaining -= 1
                    except Exception as e:
                        errors.append({"activity_id": it.get("id"), "error": str(e)})
                        remaining -= 1
            page += 1

    return JSONResponse(
        {
            "ok": True,
            "summary": {
                "imported": len(imported),
                "already": len(already),
                "would_import": len(skipped) if dry_run else 0,
                "errors": len(errors),
            },
            "imported_ids": imported,
            "already_ids": already,
            "would_import_ids": skipped if dry_run else [],
            "errors": errors,
        }
    )
