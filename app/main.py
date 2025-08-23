from fastapi import FastAPI
from app.api.pace_calc import router as pace_calc_router
from fastapi.staticfiles import StaticFiles  

app = FastAPI(title="Chosen Running", version="0.1.0")
app.include_router(pace_calc_router)

# serve files from app/web at /static
app.mount("/static", StaticFiles(directory="app/web", html=True), name="static")

@app.get("/health")
def health():
    return {"status": "ok"}