from fastapi import APIRouter

router = APIRouter(prefix="/pace-calc", tags=["pace"])

@router.get("")
def pace_calc_placeholder():
    # Connect to functions later
    return {"status": "ok", "message": "Pace Calculator coming soon"}