from __future__ import annotations

"""Runs CRUD API for the CHSN Running platform.

This module defines a simple in-memory CRUD for run logs. It is intentionally
minimal and framework-idiomatic so it can later be swapped for a real database
layer without rewriting handlers.

Highlights
----------
- Clear Pydantic models (`RunIn`, `Run`) with field descriptions for better docs.
- Descriptive `summary`, `response_description`, and example payloads per route.
- Consistent 404 handling and a standards-correct 204 No Content on delete.
- Import from Strava: POST /runs/from-strava

NOTE: The in-memory `DB` is a placeholder. It resets on process restart.
"""

from datetime import datetime
from typing import Optional, Literal, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field
import httpx
from dateutil import parser as dateparser
from fastapi import Body
from app.api import strava as strava_api

# Router metadata
router = APIRouter(prefix="/runs", tags=["Runs"])  # preserve path for compatibility

M_PER_MI = 1609.344


# ---- Models ----
RunType = Literal["Easy Run", "Workout", "Long Run", "Race"]


class RunIn(BaseModel):
    """Payload for creating/updating a run."""

    title: str = Field(..., description="Short label for the run (e.g., 'Tempo 3x1mi')")
    description: Optional[str] = Field(
        default="", description="Freeform notes: conditions, route, splits, etc."
    )
    started_at: datetime = Field(..., description="Start datetime (ISO 8601)")
    distance: float = Field(..., gt=0, description="Distance in the selected unit (> 0)")
    unit: Literal["mi", "km"] = Field(
        default="mi", description="Unit for distance and pace calculations"
    )
    duration_s: int = Field(..., gt=0, description="Total elapsed time in seconds (> 0)")
    run_type: RunType = Field(default="Easy Run", description="Categorization of the run")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "title": "Easy neighborhood loop",
                    "description": "Felt good. Kept HR < 150.",
                    "started_at": "2025-09-10T07:15:00-04:00",
                    "distance": 5.2,
                    "unit": "mi",
                    "duration_s": 2700,
                    "run_type": "Easy Run",
                }
            ]
        }
    }


class Run(RunIn):
    """Stored run with server-assigned identifier."""

    id: str = Field(description="Server-generated identifier (hex string)")


class CreateRunFromStravaIn(BaseModel):
    """Create a run by importing a Strava activity.

    Only `activity_id` is required. If `athlete_id` is omitted and only one
    athlete is connected (dev), the backend will auto-resolve it.
    """
    activity_id: int = Field(..., description="Strava activity id to import")
    athlete_id: Optional[int] = Field(None, description="Strava athlete id (optional in dev)")
    title: Optional[str] = Field(None, description="Override the run title; defaults to the Strava activity name")
    unit: Literal["mi", "km"] = Field("mi", description="Unit for distance")
    run_type: RunType = Field("Easy Run", description="Categorization of the run")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"activity_id": 1234567890, "title": "Track workout", "run_type": "Workout"}
            ]
        }
    }


# ---- In-memory DB (temporary) ----
DB: dict[str, Run] = {}


# ---- CRUD ----
@router.post(
    "",
    response_model=Run,
    status_code=201,
    summary="Create a run",
    response_description="The created run including its generated `id`.",
)
def create_run(run: RunIn) -> Run:
    """Create a new run entry.

    Returns the stored object with a generated `id`.
    """

    run_id = uuid4().hex
    obj = Run(id=run_id, **run.model_dump())
    DB[run_id] = obj
    return obj


@router.get(
    "",
    response_model=List[Run],
    summary="List runs",
    response_description="An array of stored runs (order is unspecified).",
)
def list_runs() -> List[Run]:
    """Return all runs currently in the in-memory store.

    NOTE: This is a placeholder; paging and filtering can be added once a real
    persistence layer exists.
    """

    return list(DB.values())


@router.get(
    "/{run_id}",
    response_model=Run,
    summary="Get a run by id",
    responses={
        404: {
            "description": "Run not found",
            "content": {"application/json": {"example": {"detail": "Run not found"}}},
        }
    },
)
def get_run(run_id: str) -> Run:
    """Fetch a single run by its identifier."""

    if run_id not in DB:
        raise HTTPException(status_code=404, detail="Run not found")
    return DB[run_id]


@router.put(
    "/{run_id}",
    response_model=Run,
    summary="Update a run by id",
    responses={
        404: {
            "description": "Run not found",
            "content": {"application/json": {"example": {"detail": "Run not found"}}},
        }
    },
)
def update_run(run_id: str, run: RunIn) -> Run:
    """Replace a run's fields with the provided payload."""

    if run_id not in DB:
        raise HTTPException(status_code=404, detail="Run not found")
    obj = Run(id=run_id, **run.model_dump())
    DB[run_id] = obj
    return obj


@router.post(
    "/from-strava",
    response_model=Run,
    status_code=201,
    summary="Create a run from a Strava activity",
    response_description="The created run imported from Strava.",
)
async def create_run_from_strava(payload: CreateRunFromStravaIn = Body(...)) -> Run:
    """Import a Strava activity and store it as a run.

    This calls Strava's activity detail endpoint using the connected athlete's
    token (via `strava_api._ensure_token`) and maps fields into our `Run`.
    We purposefully **do not** call our public `/strava/activities/{id}/preview`
    endpoint here to avoid an internal HTTP roundtrip and keep the server as
    source-of-truth.
    """
    # Resolve token for the athlete (auto-resolve allowed in dev)
    athlete_id = payload.athlete_id
    token = await strava_api._ensure_token(athlete_id if athlete_id is not None else strava_api._resolve_athlete_id(None))

    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"https://www.strava.com/api/v3/activities/{payload.activity_id}", headers=headers, params={"include_all_efforts": "false"})
    if r.status_code != 200:
        try:
            detail = r.json()
        except Exception:
            detail = r.text
        raise HTTPException(status_code=502, detail={"reason": "strava_activity_fetch_failed", "upstream": detail})

    act = r.json()

    # Map fields
    distance_m = act.get("distance") or 0
    moving_time_s = act.get("moving_time") or 0
    name = payload.title or act.get("name") or "Strava Run"
    description = act.get("description") or ""

    # Parse local start time if available, fallback to UTC start_date
    start_iso = act.get("start_date_local") or act.get("start_date")
    try:
        started_at = dateparser.parse(start_iso) if start_iso else datetime.utcnow()
    except Exception:
        started_at = datetime.utcnow()

    # Unit conversion
    if payload.unit == "mi":
        distance = round(distance_m / M_PER_MI, 3)
    else:  # km
        distance = round(distance_m / 1000.0, 3)

    run_in = RunIn(
        title=name,
        description=description,
        started_at=started_at,
        distance=distance,
        unit=payload.unit,
        duration_s=int(moving_time_s),
        run_type=payload.run_type,
    )

    # Reuse existing creator to get an id and perform uniform validation
    return create_run(run_in)


@router.delete(
    "/{run_id}",
    status_code=204,
    response_class=Response,
    summary="Delete a run by id",
    responses={
        204: {"description": "Deleted successfully (no response body)"},
        404: {
            "description": "Run not found",
            "content": {"application/json": {"example": {"detail": "Run not found"}}},
        },
    },
)
def delete_run(run_id: str) -> Response:
    """Delete a run. Returns 204 No Content on success."""

    if DB.pop(run_id, None) is None:
        raise HTTPException(status_code=404, detail="Run not found")
    # IMPORTANT: return a bare Response (no body) for 204
    return Response(status_code=204)