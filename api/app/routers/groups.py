from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.db import engine

router = APIRouter(prefix="/groups", tags=["groups"])


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_hidden: bool | None = None


def _validate_group_id(group_id: str) -> str:
    try:
        return str(uuid.UUID(group_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="group_id inválido") from exc


@router.get("")
def list_groups() -> dict[str, list[dict[str, object]]]:
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT id::text AS id, name, is_hidden
                FROM parcel_groups
                ORDER BY created_at ASC, name ASC
                """
            )
        ).mappings().all()

    return {"groups": [dict(row) for row in rows]}


@router.post("", status_code=status.HTTP_201_CREATED)
def create_group(payload: GroupCreate) -> dict[str, object]:
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre del grupo no puede estar vacío")

    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO parcel_groups (name)
                VALUES (:name)
                RETURNING id::text AS id, name, is_hidden
                """
            ),
            {"name": name},
        ).mappings().one()

    return dict(row)


@router.patch("/{group_id}")
def update_group(group_id: str, payload: GroupUpdate) -> dict[str, bool]:
    validated_id = _validate_group_id(group_id)
    name = payload.name.strip() if payload.name is not None else None

    if payload.name is not None and not name:
        raise HTTPException(status_code=400, detail="El nombre del grupo no puede estar vacío")

    with engine.begin() as conn:
        result = conn.execute(
            text(
                """
                UPDATE parcel_groups
                SET
                    name = COALESCE(:name, name),
                    is_hidden = COALESCE(:is_hidden, is_hidden),
                    updated_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {
                "id": validated_id,
                "name": name,
                "is_hidden": payload.is_hidden,
            },
        )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    return {"ok": True}


@router.delete("/{group_id}")
def delete_group(group_id: str) -> dict[str, bool]:
    validated_id = _validate_group_id(group_id)

    with engine.begin() as conn:
        result = conn.execute(
            text("DELETE FROM parcel_groups WHERE id = CAST(:id AS uuid)"),
            {"id": validated_id},
        )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Grupo no encontrado")

    return {"ok": True}
