from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # External services
    STRAVA_CLIENT_ID: str | None = None
    STRAVA_CLIENT_SECRET: str | None = None

    # Base URL used for callback assembly (optional; router derives from request if missing)
    BASE_URL: str | None = None

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

