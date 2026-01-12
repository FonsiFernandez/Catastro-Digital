from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from typing import Optional
import uuid

from app.db import engine

router = APIRouter(prefix="/groups", tags=["groups"])


class GroupCreate(BaseModel):
    name: str


class GroupUpdate(BaseModel):
    name: Optional[str] = None
    is_hidden: Optional[bool] = None


@router.get("")
def list_groups():
    with engine.begin() as conn:
        rows = conn.execute(
            text("""
                 SELECT id::text AS id, name, is_hidden
                 FROM parcel_groups
                 ORDER BY created_at ASC
                 """)
        ).mappings().all()

    return {"groups": list(rows)}


@router.post("")
def create_group(payload: GroupCreate):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="name vacío")

    with engine.begin() as conn:
        row = conn.execute(
            text("""
                 INSERT INTO parcel_groups (name)
                 VALUES (:name)
                     RETURNING id::text AS id, name, is_hidden
                 """),
            {"name": name},
        ).mappings().first()

    return row


@router.patch("/{group_id}")
def update_group(group_id: str, payload: GroupUpdate):
    try:
        uuid.UUID(group_id)
    except Exception:
        raise HTTPException(status_code=400, detail="group_id inválido")

    with engine.begin() as conn:
        conn.execute(
            text("""
                 UPDATE parcel_groups
                 SET
                     name = COALESCE(:name, name),
                     is_hidden = COALESCE(:is_hidden, is_hidden)
                 WHERE id = :id::uuid
                 """),
            {"id": group_id, "name": payload.name, "is_hidden": payload.is_hidden},
        )

    return {"ok": True}
