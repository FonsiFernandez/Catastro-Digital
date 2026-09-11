from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.auth.dependencies import get_current_user
from app.db import engine
from app.models import User

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
        raise HTTPException(
            status_code=400,
            detail="group_id inválido",
        ) from exc


@router.get("")
def list_groups(
        current_user: User = Depends(get_current_user),
) -> dict[str, list[dict[str, object]]]:
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT
                    g.id::text AS id,
                    g.name,
                    g.is_hidden,
                    COALESCE(stats.parcel_count, 0)::int AS parcel_count,
                    COALESCE(stats.area_m2, 0)::double precision AS area_m2,
                    COALESCE(stats.area_m2, 0)::double precision / 10000.0 AS area_ha,
                    COALESCE(stats.perimeter_m, 0)::double precision AS perimeter_m
                FROM parcel_groups g
                    LEFT JOIN LATERAL (
                    SELECT
                    COUNT(*)::int AS parcel_count,
                    SUM(
                    ST_Area(cp.geom_official::geography)
                    ) AS area_m2,
                    CASE
                    WHEN COUNT(*) = 0 THEN 0
                    ELSE ST_Perimeter(
                    ST_UnaryUnion(
                    ST_Collect(cp.geom_official)
                    )::geography
                    )
                    END AS perimeter_m
                    FROM user_parcels up
                    INNER JOIN cadastral_parcels cp
                    ON cp.cadastral_ref = up.cadastral_ref
                    WHERE up.group_id = g.id
                    AND up.user_id = CAST(:user_id AS uuid)
                    AND up.is_deleted = FALSE
                    ) stats ON TRUE
                WHERE g.user_id = CAST(:user_id AS uuid)
                ORDER BY g.created_at ASC, g.name ASC
                """
            ),
            {
                "user_id": str(current_user.id),
            },
        ).mappings().all()

    return {
        "groups": [dict(row) for row in rows],
    }


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
)
def create_group(
        payload: GroupCreate,
        current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    name = payload.name.strip()

    if not name:
        raise HTTPException(
            status_code=400,
            detail="El nombre del grupo no puede estar vacío",
        )

    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                INSERT INTO parcel_groups (
                    user_id,
                    name
                )
                VALUES (
                           CAST(:user_id AS uuid),
                           :name
                       )
                    RETURNING
                    id::text AS id,
                    name,
                    is_hidden
                """
            ),
            {
                "user_id": str(current_user.id),
                "name": name,
            },
        ).mappings().one()

    return {
        **dict(row),
        "parcel_count": 0,
        "area_m2": 0.0,
        "area_ha": 0.0,
        "perimeter_m": 0.0,
    }


@router.patch("/{group_id}")
def update_group(
        group_id: str,
        payload: GroupUpdate,
        current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    validated_id = _validate_group_id(group_id)

    name = (
        payload.name.strip()
        if payload.name is not None
        else None
    )

    if payload.name is not None and not name:
        raise HTTPException(
            status_code=400,
            detail="El nombre del grupo no puede estar vacío",
        )

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
                  AND user_id = CAST(:user_id AS uuid)
                """
            ),
            {
                "id": validated_id,
                "user_id": str(current_user.id),
                "name": name,
                "is_hidden": payload.is_hidden,
            },
        )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Grupo no encontrado",
        )

    return {"ok": True}


@router.delete("/{group_id}")
def delete_group(
        group_id: str,
        current_user: User = Depends(get_current_user),
) -> dict[str, bool]:
    validated_id = _validate_group_id(group_id)

    with engine.begin() as conn:
        result = conn.execute(
            text(
                """
                DELETE FROM parcel_groups
                WHERE id = CAST(:id AS uuid)
                  AND user_id = CAST(:user_id AS uuid)
                """
            ),
            {
                "id": validated_id,
                "user_id": str(current_user.id),
            },
        )

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Grupo no encontrado",
        )

    return {"ok": True}