from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime
from uuid import uuid4

router = APIRouter(prefix="/runs", tags=["runs"])

# ---- Models ----
RunType = Literal["Easy Run", "Workout", "Long Run", "Race"]

class RunIn(BaseModel):
    title: str
    description: Optional[str] = ""
    started_at: datetime
    distance: float = Field(gt=0)
    unit: Literal["mi", "km"] = "mi"
    duration_s: int = Field(gt=0)
    run_type: RunType = "Easy Run"

class Run(RunIn):
    id: str

# ---- In-memory DB (temporary) ----
DB: dict[str, Run] = {}

# ---- CRUD ----
@router.post("", response_model=Run, status_code=201)
def create_run(run: RunIn):
    run_id = uuid4().hex
    obj = Run(id=run_id, **run.model_dump())
    DB[run_id] = obj
    return obj

@router.get("", response_model=List[Run])
def list_runs():
    return list(DB.values())

@router.get("/{run_id}", response_model=Run)
def get_run(run_id: str):
    if run_id not in DB:
        raise HTTPException(status_code=404, detail="Run not found")
    return DB[run_id]

@router.put("/{run_id}", response_model=Run)
def update_run(run_id: str, run: RunIn):
    if run_id not in DB:
        raise HTTPException(status_code=404, detail="Run not found")
    obj = Run(id=run_id, **run.model_dump())
    DB[run_id] = obj
    return obj

@router.delete("/{run_id}", status_code=204, response_class=Response)
def delete_run(run_id: str):
    if DB.pop(run_id, None) is None:
        raise HTTPException(status_code=404, detail="Run not found")
    # IMPORTANT: return a bare Response (no body) for 204
    return Response(status_code=204)