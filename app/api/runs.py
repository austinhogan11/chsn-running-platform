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
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field
import httpx
from dateutil import parser as dateparser
from fastapi import Body
from app.api import strava as strava_api
from app.models.runs import Run as RunModel, RunCreate, RunTypeEnum, UnitEnum
from app.services.runs import RunsService
from fastapi import Depends, Request

# Router metadata
router = APIRouter(prefix="/runs", tags=["Runs"])  # preserve path for compatibility
def get_runs_service(request: Request) -> RunsService:
    return request.app.state.runs_service

M_PER_MI = 1609.344


class CreateRunFromStravaIn(BaseModel):
    """Create a run by importing a Strava activity.

    Only `activity_id` is required. If `athlete_id` is omitted and only one
    athlete is connected (dev), the backend will auto-resolve it.
    """
    activity_id: int = Field(..., description="Strava activity id to import")
    athlete_id: Optional[int] = Field(None, description="Strava athlete id (optional in dev)")
    title: Optional[str] = Field(None, description="Override the run title; defaults to the Strava activity name")
    unit: UnitEnum = Field(UnitEnum.mi, description="Unit for distance")
    run_type: RunTypeEnum = Field(RunTypeEnum.easy, description="Categorization of the run")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {"activity_id": 1234567890, "title": "Track workout", "run_type": "Workout"}
            ]
        }
    }


# ---- CRUD ----
@router.post(
    "",
    response_model=RunModel,
    status_code=201,
    summary="Create a run",
    response_description="The created run including its generated `id`.",
)
def create_run(run: RunCreate, svc: RunsService = Depends(get_runs_service)) -> RunModel:
    return svc.create(run)


@router.get(
    "",
    response_model=List[RunModel],
    summary="List runs",
    response_description="An array of stored runs (order is unspecified).",
)
def list_runs(svc: RunsService = Depends(get_runs_service)) -> List[RunModel]:
    return svc.list_runs()


@router.get(
    "/{run_id}",
    response_model=RunModel,
    summary="Get a run by id",
    responses={
        404: {
            "description": "Run not found",
            "content": {"application/json": {"example": {"detail": "Run not found"}}},
        }
    },
)
def get_run(run_id: int, svc: RunsService = Depends(get_runs_service)) -> RunModel:
    obj = svc.get(run_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Run not found")
    return obj


@router.put(
    "/{run_id}",
    response_model=RunModel,
    summary="Update a run by id",
    responses={
        404: {
            "description": "Run not found",
            "content": {"application/json": {"example": {"detail": "Run not found"}}},
        }
    },
)
def update_run(run_id: int, run: RunCreate, svc: RunsService = Depends(get_runs_service)) -> RunModel:
    obj = svc.update(run_id, run)
    if not obj:
        raise HTTPException(status_code=404, detail="Run not found")
    return obj


@router.post(
    "/from-strava",
    response_model=RunModel,
    status_code=201,
    summary="Create a run from a Strava activity",
    response_description="The created run imported from Strava.",
)
async def create_run_from_strava(payload: CreateRunFromStravaIn = Body(...), svc: RunsService = Depends(get_runs_service)) -> RunModel:
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

    # Elevation in feet if available
    elev_ft = (act.get("total_elevation_gain") or 0) * 3.28084

    run_in = RunCreate(
        title=name,
        description=description,
        started_at=started_at,
        distance=distance,
        unit=payload.unit,
        duration_s=int(moving_time_s),
        run_type=payload.run_type,
        elevation_ft=elev_ft,
        source="strava",
        source_ref=str(payload.activity_id),
    )
    created = svc.create(run_in)
    return created


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
def delete_run(run_id: int, svc: RunsService = Depends(get_runs_service)) -> Response:
    """Delete a run. Returns 204 No Content on success."""
    if not svc.get(run_id):
        raise HTTPException(status_code=404, detail="Run not found")
    svc.delete(run_id)
    return Response(status_code=204)
