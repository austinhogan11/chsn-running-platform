"""Main application entrypoint for the CHSN Running Platform.

This module creates and configures the FastAPI application, wires up API routers,
serves the static web UI, and exposes a simple health-check endpoint.

Structure
---------
- `create_app()` returns a configured `FastAPI` instance (app factory pattern).
- Routers are imported from `app.api` and included without altering their paths.
- Static files are served from `app/web` under the `/static` mount.

Notes
-----
- Paths are resolved from this file's location to avoid issues with the working
  directory when starting the app from different places (e.g., uvicorn vs tests).
- Keep business logic in routers; this module focuses on composition/assembly.
"""
from __future__ import annotations

from pathlib import Path
from typing import Literal

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import os
from dotenv import load_dotenv
load_dotenv()
from app.api import strava as strava_api
from app.api.pace_calc import router as pace_calc_router
from app.api.runs import router as runs_router

__all__ = ["app", "create_app"]


class HealthResponse(BaseModel):
    """Response schema for the health-check endpoint."""

    status: Literal["ok"]


def _static_dir() -> str:
    """Return the absolute path to the static files directory (`app/web`).

    Using a function keeps resolution logic in one place and makes it easier
    to test or modify later if the web root moves.
    """

    # `app/main.py` -> parent is `app/`; append `web` to get `app/web`.
    return str((Path(__file__).parent / "web").resolve())


def create_app() -> FastAPI:
    """Application factory.

    Returns
    -------
    FastAPI
        A configured FastAPI instance with routers and static files mounted.
    """

    app = FastAPI(title="Chosen Running", version="0.1.0")

    # API routers (keep router-level prefixes and tags defined in their modules)
    app.include_router(pace_calc_router)
    app.include_router(runs_router)
    app.include_router(strava_api.router)

    # Serve the web UI (built or static assets) at `/static`
    app.mount("/static", StaticFiles(directory=_static_dir(), html=True), name="static")

    @app.get("/health", response_model=HealthResponse, summary="Health check")
    def health() -> HealthResponse:  # pragma: no cover - trivial
        """Simple liveness check for uptime monitoring and load balancers."""

        return HealthResponse(status="ok")

    return app


# Expose a module-level `app` for ASGI servers (uvicorn, hypercorn, etc.).
app = create_app()