# app/services/runs.py
from __future__ import annotations
import os
import sqlite3
from pathlib import Path
from typing import List, Optional, Dict, Any

from app.models.runs import Run, RunCreate, UnitEnum


_DB_PATH = Path("app/data/app.db")


def _ensure_db() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH))
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
          pace_s INTEGER,
          pace TEXT
        );
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs(started_at DESC);")
    conn.commit()
    return conn


def _sec_to_mmss(sec: int) -> str:
    if sec <= 0:
        return "00:00"
    m, s = divmod(int(round(sec)), 60)
    return f"{m:02d}:{s:02d}"


class RunsService:
    """Tiny DAO/service using sqlite3. No external deps."""

    def __init__(self) -> None:
        self.conn = _ensure_db()

    # ---------- CRUD ----------
    def list_runs(self) -> List[Run]:
        cur = self.conn.execute(
            "SELECT id, title, description, started_at, distance, unit, duration_s, pace_s, pace "
            "FROM runs ORDER BY started_at DESC, id DESC"
        )
        items = [self._row_to_model(r) for r in cur.fetchall()]
        return items

    def get(self, run_id: int) -> Optional[Run]:
        cur = self.conn.execute(
            "SELECT id, title, description, started_at, distance, unit, duration_s, pace_s, pace "
            "FROM runs WHERE id = ?",
            (run_id,),
        )
        row = cur.fetchone()
        return self._row_to_model(row) if row else None

    def create(self, payload: RunCreate) -> Run:
        # compute pace if not provided
        pace_s = payload.pace_s
        if pace_s is None and payload.distance > 0 and payload.duration_s > 0:
            pace_s = int(round(payload.duration_s / payload.distance))
        pace = payload.pace or (_sec_to_mmss(pace_s) if pace_s else None)

        self.conn.execute(
            """
            INSERT INTO runs (title, description, started_at, distance, unit, duration_s, pace_s, pace)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.title,
                payload.description,
                payload.started_at.isoformat(),
                float(payload.distance),
                payload.unit.value if isinstance(payload.unit, UnitEnum) else str(payload.unit),
                int(payload.duration_s),
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
        self.conn.execute("DELETE FROM runs WHERE id = ?", (run_id,))
        self.conn.commit()

    # ---------- helpers ----------
    def _row_to_model(self, row: sqlite3.Row) -> Run:
        data: Dict[str, Any] = dict(row)
        return Run(
            id=int(data["id"]),
            title=data["title"],
            description=data.get("description"),
            started_at=data["started_at"],  # pydantic will coerce ISO string → datetime
            distance=float(data["distance"]),
            unit=UnitEnum(data["unit"]),
            duration_s=int(data["duration_s"]),
            pace_s=int(data["pace_s"]) if data["pace_s"] is not None else None,
            pace=data.get("pace"),
        )