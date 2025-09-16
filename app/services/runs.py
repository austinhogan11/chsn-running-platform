"""Service module for managing run records using SQLite.

Provides CRUD operations for run data, backed by a local SQLite database.
Includes functionality to initialize the database schema, convert time formats,
and map database rows to Run models.
"""
from __future__ import annotations
import os
import sqlite3
import threading
from pathlib import Path
from typing import List, Optional, Dict, Any

from app.models.runs import Run, RunCreate, UnitEnum


_DB_PATH = Path("app/data/app.db")


def _ensure_db() -> sqlite3.Connection:
    """Initialize the SQLite database, ensuring schema and indexes exist.

    Returns:
        sqlite3.Connection: A connection to the SQLite database.
    """
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    # Allow use across threads (FastAPI/Starlette can execute handlers in threadpool)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS runs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          started_at TEXT NOT NULL,
          distance REAL NOT NULL,
          unit TEXT CHECK(unit IN ('mi','km')) NOT NULL DEFAULT 'mi',
          duration_s INTEGER NOT NULL,
          elevation_ft REAL,
          source TEXT,
          source_ref TEXT,
          pace_s INTEGER,
          pace TEXT
        );
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at DESC);")
    conn.commit()
    return conn


def _sec_to_mmss(sec: int) -> str:
    """Convert seconds to a MM:SS formatted string.

    Args:
        sec (int): The number of seconds.

    Returns:
        str: The time formatted as 'MM:SS'. Returns '00:00' if input is zero or negative.
    """
    if sec <= 0:
        return "00:00"
    m, s = divmod(int(round(sec)), 60)
    return f"{m:02d}:{s:02d}"


class RunsService:
    """Data Access Object (DAO) for run records.

    Provides a simple persistence layer backed by SQLite for storing,
    retrieving, creating, and deleting run entries.
    """

    def __init__(self) -> None:
        self.conn = _ensure_db()
        self._lock = threading.RLock()

    def close(self) -> None:
        try:
            self.conn.close()
        except Exception:
            pass

    # ---------- CRUD ----------
    def list_runs(self) -> List[Run]:
        """Retrieve all runs ordered by start time descending.

        Returns:
            List[Run]: A list of Run models sorted by started_at descending.
        """
        with self._lock:
            cur = self.conn.execute(
            "SELECT id, title, description, started_at, distance, unit, duration_s, elevation_ft, source, source_ref, pace_s, pace "
            "FROM runs ORDER BY started_at DESC, id DESC"
        )
        items = [self._row_to_model(r) for r in cur.fetchall()]
        return items

    def get(self, run_id: int) -> Optional[Run]:
        """Retrieve a single run by its ID.

        Args:
            run_id (int): The ID of the run to retrieve.

        Returns:
            Optional[Run]: The Run model if found, otherwise None.
        """
        with self._lock:
            cur = self.conn.execute(
            "SELECT id, title, description, started_at, distance, unit, duration_s, elevation_ft, source, source_ref, pace_s, pace "
            "FROM runs WHERE id = ?",
            (run_id,),
        )
        row = cur.fetchone()
        return self._row_to_model(row) if row else None

    def create(self, payload: RunCreate) -> Run:
        """Create a new run record.

        Computes pace if not provided in the payload.

        Args:
            payload (RunCreate): The data for the new run.

        Returns:
            Run: The newly created Run model.
        """
        # compute pace if not provided
        pace_s = payload.pace_s
        if pace_s is None and payload.distance > 0 and payload.duration_s > 0:
            pace_s = int(round(payload.duration_s / payload.distance))
        pace = payload.pace or (_sec_to_mmss(pace_s) if pace_s else None)

        with self._lock:
            self.conn.execute(
            """
            INSERT INTO runs (title, description, started_at, distance, unit, duration_s, elevation_ft, source, source_ref, pace_s, pace)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.title,
                payload.description,
                payload.started_at.isoformat(),
                float(payload.distance),
                payload.unit.value if isinstance(payload.unit, UnitEnum) else str(payload.unit),
                int(payload.duration_s),
                float(payload.elevation_ft) if payload.elevation_ft is not None else None,
                payload.source,
                payload.source_ref,
                int(pace_s) if pace_s else None,
                pace,
            ),
        )
        self.conn.commit()

        new_id = self.conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        created = self.get(new_id)
        assert created is not None
        return created

    def delete(self, run_id: int) -> None:
        """Delete a run record by its ID.

        Args:
            run_id (int): The ID of the run to delete.
        """
        with self._lock:
            self.conn.execute("DELETE FROM runs WHERE id = ?", (run_id,))
            self.conn.commit()

    def update(self, run_id: int, payload: RunCreate) -> Optional[Run]:
        """Replace a run by ID with new values.

        Returns the updated Run or None if not found.
        """
        if not self.get(run_id):
            return None

        pace_s = payload.pace_s
        if pace_s is None and payload.distance > 0 and payload.duration_s > 0:
            pace_s = int(round(payload.duration_s / payload.distance))
        pace = payload.pace or (_sec_to_mmss(pace_s) if pace_s else None)

        with self._lock:
            self.conn.execute(
            """
            UPDATE runs
            SET title = ?, description = ?, started_at = ?, distance = ?, unit = ?, duration_s = ?,
                elevation_ft = ?, source = ?, source_ref = ?, pace_s = ?, pace = ?
            WHERE id = ?
            """,
            (
                payload.title,
                payload.description,
                payload.started_at.isoformat(),
                float(payload.distance),
                payload.unit.value if isinstance(payload.unit, UnitEnum) else str(payload.unit),
                int(payload.duration_s),
                float(payload.elevation_ft) if payload.elevation_ft is not None else None,
                payload.source,
                payload.source_ref,
                int(pace_s) if pace_s else None,
                pace,
                run_id,
            ),
        )
        self.conn.commit()
        return self.get(run_id)

    # ---------- helpers ----------
    def _row_to_model(self, row: sqlite3.Row) -> Run:
        """Convert a SQLite row to a Run model instance.

        Args:
            row (sqlite3.Row): The database row representing a run.

        Returns:
            Run: The corresponding Run model.
        """
        data: Dict[str, Any] = dict(row)
        return Run(
            id=int(data["id"]),
            title=data["title"],
            description=data.get("description"),
            started_at=data["started_at"],  # pydantic will coerce ISO string → datetime
            distance=float(data["distance"]),
            unit=UnitEnum(data["unit"]),
            duration_s=int(data["duration_s"]),
            elevation_ft=float(data["elevation_ft"]) if data.get("elevation_ft") is not None else None,
            source=data.get("source"),
            source_ref=data.get("source_ref"),
            pace_s=int(data["pace_s"]) if data["pace_s"] is not None else None,
            pace=data.get("pace"),
        )
