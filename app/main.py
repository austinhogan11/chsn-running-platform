from fastapi import FastAPI
from app.api.pace import router as pace_router

app = FastAPI(title="Chosen Running", version="0.1.0")
app.include_router(pace_router)

@app.get("/health")
def health():
    return {"status": "ok"}