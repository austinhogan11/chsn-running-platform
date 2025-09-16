from pathlib import Path

import pytest

from app.services import runs as runs_module
from app.services.runs import RunsService
from app.models.runs import RunCreate, UnitEnum, RunTypeEnum


@pytest.fixture()
def temp_service(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    db = tmp_path / "app.db"
    monkeypatch.setattr(runs_module, "_DB_PATH", db)
    svc = RunsService()
    try:
        yield svc
    finally:
        svc.close()


def sample_payload(i: int = 1) -> RunCreate:
    from datetime import datetime, timezone

    return RunCreate(
        title=f"Run {i}",
        description="test",
        started_at=datetime.now(timezone.utc),
        distance=5.0,
        unit=UnitEnum.mi,
        duration_s=2400,
        run_type=RunTypeEnum.easy,
        elevation_ft=100,
    )


def test_create_get_update_delete(temp_service: RunsService):
    svc = temp_service

    # create
    created = svc.create(sample_payload())
    assert created.id > 0
    assert created.pace_s is not None

    # get
    fetched = svc.get(created.id)
    assert fetched is not None and fetched.id == created.id

    # update
    updated = svc.update(created.id, sample_payload(2))
    assert updated is not None and updated.title == "Run 2"

    # delete
    svc.delete(created.id)
    assert svc.get(created.id) is None

