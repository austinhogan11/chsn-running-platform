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

NOTE: The in-memory `DB` is a placeholder. It resets on process restart.
"""

from datetime import datetime
from typing import Optional, Literal, List
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

# Router metadata
router = APIRouter(prefix="/runs", tags=["Runs"])  # preserve path for compatibility


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