from __future__ import annotations

import json
import math
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db import engine

from app.auth.dependencies import get_current_user
from app.models import User

router = APIRouter(prefix="/backup", tags=["backup"])

BACKUP_FORMAT = "catastro-digital-backup"
BACKUP_VERSION = 3
RC_RE = re.compile(r"^[0-9A-Z]{14,20}$")
COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")


class BackupGroup(BaseModel):
    id: str
    name: str = Field(min_length=1, max_length=120)
    is_hidden: bool = False
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @field_validator("id")
    @classmethod
    def validate_id(cls, value: str) -> str:
        try:
            return str(uuid.UUID(value))
        except ValueError as exc:
            raise ValueError("group id inválido") from exc

    @field_validator("name")
    @classmethod
    def normalise_name(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("el nombre del grupo no puede estar vacío")
        return name


class BackupParcel(BaseModel):
    cadastral_ref: str
    name: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=4000)
    color: str = "#7c3aed"
    group_id: str | None = None
    is_deleted: bool = False
    geometry: dict[str, Any]
    created_at: datetime | None = None
    updated_at: datetime | None = None
    last_fetched_at: datetime | None = None
    deleted_at: datetime | None = None

    @field_validator("cadastral_ref")
    @classmethod
    def normalise_rc(cls, value: str) -> str:
        rc = "".join(value.split()).upper()
        if not RC_RE.fullmatch(rc):
            raise ValueError("referencia catastral inválida")
        return rc

    @field_validator("name")
    @classmethod
    def normalise_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("notes")
    @classmethod
    def normalise_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("color")
    @classmethod
    def normalise_color(cls, value: str) -> str:
        color = value.strip().lower()
        if not COLOR_RE.fullmatch(color):
            raise ValueError("color inválido; debe tener formato #RRGGBB")
        return color

    @field_validator("group_id")
    @classmethod
    def validate_group_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            return str(uuid.UUID(value))
        except ValueError as exc:
            raise ValueError("group_id inválido") from exc

    @field_validator("geometry")
    @classmethod
    def validate_geometry_shape(cls, value: dict[str, Any]) -> dict[str, Any]:
        geometry_type = value.get("type")
        if geometry_type not in {"Polygon", "MultiPolygon"}:
            raise ValueError("la geometría debe ser Polygon o MultiPolygon")
        coordinates = value.get("coordinates")
        if not isinstance(coordinates, list) or not coordinates:
            raise ValueError("la geometría no contiene coordenadas")
        return value


class BackupDocument(BaseModel):
    format: Literal["catastro-digital-backup"] = BACKUP_FORMAT
    version: Literal[1, 2, 3] = BACKUP_VERSION
    exported_at: datetime
    groups: list[BackupGroup]
    parcels: list[BackupParcel]

    @model_validator(mode="after")
    def validate_relations(self) -> "BackupDocument":
        group_ids = [group.id for group in self.groups]
        if len(group_ids) != len(set(group_ids)):
            raise ValueError("el backup contiene IDs de grupo duplicados")

        parcel_refs = [parcel.cadastral_ref for parcel in self.parcels]
        if len(parcel_refs) != len(set(parcel_refs)):
            raise ValueError("el backup contiene referencias catastrales duplicadas")

        known_group_ids = set(group_ids)
        missing = sorted(
            {
                parcel.group_id
                for parcel in self.parcels
                if parcel.group_id is not None and parcel.group_id not in known_group_ids
            }
        )
        if missing:
            raise ValueError(
                "el backup contiene parcelas que apuntan a grupos no incluidos: "
                + ", ".join(missing[:3])
            )
        return self


class ImportResult(BaseModel):
    ok: bool
    dry_run: bool
    mode: Literal["merge", "replace"]
    groups: int
    parcels: int


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _validate_coordinate_ranges(value: Any) -> bool:
    """Check every leaf coordinate pair is finite WGS84 longitude/latitude."""

    if not isinstance(value, list) or not value:
        return False

    if len(value) >= 2 and all(isinstance(item, (int, float)) for item in value[:2]):
        lon = float(value[0])
        lat = float(value[1])
        return math.isfinite(lon) and math.isfinite(lat) and -180 <= lon <= 180 and -90 <= lat <= 90

    return all(_validate_coordinate_ranges(item) for item in value)


def _validate_geometries(document: BackupDocument) -> None:
    for parcel in document.parcels:
        if not _validate_coordinate_ranges(parcel.geometry.get("coordinates")):
            raise HTTPException(
                status_code=400,
                detail=f"Geometría fuera de rango WGS84 en {parcel.cadastral_ref}",
            )

    try:
        with engine.begin() as conn:
            for parcel in document.parcels:
                geometry_json = json.dumps(parcel.geometry, separators=(",", ":"))
                valid = conn.execute(
                    text(
                        """
                        SELECT
                            ST_IsValid(geom)
                            AND NOT ST_IsEmpty(geom)
                            AND GeometryType(geom) = 'MULTIPOLYGON'
                        FROM (
                            SELECT ST_Multi(
                                ST_SetSRID(ST_GeomFromGeoJSON(:geometry), 4326)
                            ) AS geom
                        ) candidate
                        """
                    ),
                    {"geometry": geometry_json},
                ).scalar_one()
                if not valid:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Geometría inválida en {parcel.cadastral_ref}",
                    )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=400, detail="El backup contiene una geometría GeoJSON inválida") from exc


@router.get("")
def export_backup(
        current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = str(current_user.id)

    with engine.begin() as conn:
        group_rows = conn.execute(
            text(
                """
                SELECT
                    id::text AS id,
                    name,
                    is_hidden,
                    created_at,
                    updated_at
                FROM parcel_groups
                WHERE user_id = CAST(:user_id AS uuid)
                ORDER BY created_at ASC, name ASC
                """
            ),
            {
                "user_id": user_id,
            },
        ).mappings().all()

        parcel_rows = conn.execute(
            text(
                """
                SELECT
                    up.cadastral_ref,
                    up.name,
                    up.notes,
                    up.color,
                    up.group_id::text AS group_id,
                    up.is_deleted,

                    ST_AsGeoJSON(
                            cp.geom_official
                    ) AS geometry,

                    up.created_at,
                    up.updated_at,

                    cp.last_fetched_at,

                    up.deleted_at

                FROM user_parcels up

                         INNER JOIN cadastral_parcels cp
                                    ON cp.cadastral_ref = up.cadastral_ref

                WHERE up.user_id = CAST(:user_id AS uuid)

                ORDER BY
                    up.created_at ASC,
                    up.cadastral_ref ASC
                """
            ),
            {
                "user_id": user_id,
            },
        ).mappings().all()

    return {
        "format": BACKUP_FORMAT,
        "version": BACKUP_VERSION,
        "exported_at": datetime.now(timezone.utc).isoformat(),

        "groups": [
            {
                "id": row["id"],
                "name": row["name"],
                "is_hidden": row["is_hidden"],
                "created_at": _iso(row["created_at"]),
                "updated_at": _iso(row["updated_at"]),
            }
            for row in group_rows
        ],

        "parcels": [
            {
                "cadastral_ref": row["cadastral_ref"],
                "name": row["name"],
                "notes": row["notes"],
                "color": row["color"],
                "group_id": row["group_id"],
                "is_deleted": row["is_deleted"],
                "geometry": json.loads(row["geometry"]),
                "created_at": _iso(row["created_at"]),
                "updated_at": _iso(row["updated_at"]),
                "last_fetched_at": _iso(row["last_fetched_at"]),
                "deleted_at": _iso(row["deleted_at"]),
            }
            for row in parcel_rows
        ],
    }


@router.get("/geojson")
def export_geojson(
        current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    user_id = str(current_user.id)

    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT
                    up.cadastral_ref,
                    up.name,
                    up.notes,
                    up.color,
                    up.group_id::text AS group_id,
                    g.name AS group_name,
                    up.is_deleted,

                    ST_Area(
                            cp.geom_official::geography
                    )::double precision AS area_m2,

                    (
                        ST_Area(
                            cp.geom_official::geography
                        ) / 10000.0
                    )::double precision AS area_ha,

                    ST_Perimeter(
                        cp.geom_official::geography
                    )::double precision AS perimeter_m,

                    ST_AsGeoJSON(
                        cp.geom_official
                    ) AS geometry

                FROM user_parcels up

                    INNER JOIN cadastral_parcels cp
                ON cp.cadastral_ref = up.cadastral_ref

                    LEFT JOIN parcel_groups g
                    ON g.id = up.group_id
                    AND g.user_id = up.user_id

                WHERE up.user_id = CAST(:user_id AS uuid)

                ORDER BY
                    up.created_at ASC,
                    up.cadastral_ref ASC
                """
            ),
            {
                "user_id": user_id,
            },
        ).mappings().all()

    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": json.loads(row["geometry"]),
                "properties": {
                    "cadastral_ref": row["cadastral_ref"],
                    "name": row["name"],
                    "notes": row["notes"],
                    "color": row["color"],
                    "group_id": row["group_id"],
                    "group_name": row["group_name"],
                    "is_deleted": row["is_deleted"],
                    "area_m2": float(row["area_m2"]),
                    "area_ha": float(row["area_ha"]),
                    "perimeter_m": float(row["perimeter_m"]),
                },
            }
            for row in rows
        ],
    }


@router.post(
    "/import",
    response_model=ImportResult,
)
def import_backup(
        document: BackupDocument,
        mode: Literal["merge", "replace"] = Query("merge"),
        dry_run: bool = Query(False),
        current_user: User = Depends(get_current_user),
) -> ImportResult:
    _validate_geometries(document)

    if dry_run:
        return ImportResult(
            ok=True,
            dry_run=True,
            mode=mode,
            groups=len(document.groups),
            parcels=len(document.parcels),
        )

    now = datetime.now(timezone.utc)
    user_id = str(current_user.id)

    try:
        with engine.begin() as conn:

            # -------------------------------------------------
            # REPLACE affects only the current user's data.
            # -------------------------------------------------

            if mode == "replace":

                conn.execute(
                    text(
                        """
                        DELETE FROM user_parcels
                        WHERE user_id = CAST(:user_id AS uuid)
                        """
                    ),
                    {
                        "user_id": user_id,
                    },
                )

                conn.execute(
                    text(
                        """
                        DELETE FROM parcel_groups
                        WHERE user_id = CAST(:user_id AS uuid)
                        """
                    ),
                    {
                        "user_id": user_id,
                    },
                )

            # -------------------------------------------------
            # Map backup group IDs to destination group IDs.
            # -------------------------------------------------

            group_id_map: dict[str, str] = {}

            for group in document.groups:

                existing = conn.execute(
                    text(
                        """
                        SELECT user_id::text AS user_id
                        FROM parcel_groups
                        WHERE id = CAST(:id AS uuid)
                        """
                    ),
                    {
                        "id": group.id,
                    },
                ).mappings().first()

                if existing is None:
                    destination_id = group.id

                elif existing["user_id"] == user_id:
                    destination_id = group.id

                else:
                    # Same backup/group UUID already belongs
                    # to another account.
                    destination_id = str(uuid.uuid4())

                group_id_map[group.id] = destination_id

                conn.execute(
                    text(
                        """
                        INSERT INTO parcel_groups (
                            id,
                            user_id,
                            name,
                            is_hidden,
                            created_at,
                            updated_at
                        )
                        VALUES (
                                   CAST(:id AS uuid),
                                   CAST(:user_id AS uuid),
                                   :name,
                                   :is_hidden,
                                   COALESCE(:created_at, :now),
                                   COALESCE(:updated_at, :now)
                               )

                            ON CONFLICT (id)
                        DO UPDATE
                                                           SET
                                                               name = EXCLUDED.name,
                                                           is_hidden = EXCLUDED.is_hidden,
                                                           created_at = EXCLUDED.created_at,
                                                           updated_at = EXCLUDED.updated_at

                           WHERE parcel_groups.user_id =
                                                           EXCLUDED.user_id
                        """
                    ),
                    {
                        "id": destination_id,
                        "user_id": user_id,
                        "name": group.name,
                        "is_hidden": group.is_hidden,
                        "created_at": group.created_at,
                        "updated_at": group.updated_at,
                        "now": now,
                    },
                )

            # -------------------------------------------------
            # Parcels
            # -------------------------------------------------

            for parcel in document.parcels:

                geometry_json = json.dumps(
                    parcel.geometry,
                    separators=(",", ":"),
                )

                # ---------------------------------------------
                # Shared cadastral geometry
                # ---------------------------------------------

                conn.execute(
                    text(
                        """
                        INSERT INTO cadastral_parcels (
                            cadastral_ref,
                            geom_official,
                            last_fetched_at,
                            created_at,
                            updated_at
                        )
                        VALUES (
                                   :cadastral_ref,

                                   ST_Multi(
                                           ST_SetSRID(
                                                   ST_GeomFromGeoJSON(:geometry),
                                                   4326
                                           )
                                   ),

                                   :last_fetched_at,

                                   COALESCE(:created_at, :now),
                                   COALESCE(:updated_at, :now)
                               )

                            ON CONFLICT (cadastral_ref)
                        DO UPDATE
                                                           SET
                                                               geom_official =
                                                           EXCLUDED.geom_official,

                                                           last_fetched_at =
                                                           COALESCE(
                                                           EXCLUDED.last_fetched_at,
                                                           cadastral_parcels.last_fetched_at
                                                           ),

                                                           updated_at = EXCLUDED.updated_at
                        """
                    ),
                    {
                        "cadastral_ref": parcel.cadastral_ref,
                        "geometry": geometry_json,
                        "last_fetched_at": parcel.last_fetched_at,
                        "created_at": parcel.created_at,
                        "updated_at": parcel.updated_at,
                        "now": now,
                    },
                )

                # ---------------------------------------------
                # Resolve backup group to user's actual group.
                # ---------------------------------------------

                destination_group_id = None

                if parcel.group_id is not None:
                    destination_group_id = group_id_map[
                        parcel.group_id
                    ]

                # ---------------------------------------------
                # User-specific parcel data
                # ---------------------------------------------

                conn.execute(
                    text(
                        """
                        INSERT INTO user_parcels (
                            user_id,
                            cadastral_ref,
                            name,
                            notes,
                            color,
                            group_id,
                            is_deleted,
                            created_at,
                            updated_at,
                            deleted_at
                        )
                        VALUES (
                                   CAST(:user_id AS uuid),
                                   :cadastral_ref,
                                   :name,
                                   :notes,
                                   :color,
                                   CAST(
                                           NULLIF(:group_id, '')
                                       AS uuid
                                   ),
                                   :is_deleted,
                                   COALESCE(:created_at, :now),
                                   COALESCE(:updated_at, :now),
                                   :deleted_at
                               )

                            ON CONFLICT (
                            user_id,
                            cadastral_ref
                        )
                        DO UPDATE
                                                           SET
                                                               name = EXCLUDED.name,
                                                           notes = EXCLUDED.notes,
                                                           color = EXCLUDED.color,
                                                           group_id = EXCLUDED.group_id,
                                                           is_deleted = EXCLUDED.is_deleted,
                                                           created_at = EXCLUDED.created_at,
                                                           updated_at = EXCLUDED.updated_at,
                                                           deleted_at = EXCLUDED.deleted_at
                        """
                    ),
                    {
                        "user_id": user_id,
                        "cadastral_ref": parcel.cadastral_ref,
                        "name": parcel.name,
                        "notes": parcel.notes,
                        "color": parcel.color,
                        "group_id": destination_group_id or "",
                        "is_deleted": parcel.is_deleted,
                        "created_at": parcel.created_at,
                        "updated_at": parcel.updated_at,
                        "deleted_at": parcel.deleted_at,
                        "now": now,
                    },
                )

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                "No se pudo importar el backup. "
                "No se ha aplicado ningún cambio."
            ),
        ) from exc

    return ImportResult(
        ok=True,
        dry_run=False,
        mode=mode,
        groups=len(document.groups),
        parcels=len(document.parcels),
    )
