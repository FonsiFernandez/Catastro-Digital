from __future__ import annotations

import json
import re
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from shapely.geometry import Point, shape

from app.db import engine
from app.services.catastro_circuit import deny_for, is_denied, reason as deny_reason, remaining_seconds
from app.services.catastro_wfs import fetch_parcel_gml, fetch_parcels_around_point_gml
from app.services.gml_to_geojson import gml_text_to_geojson_feature, gml_text_to_geojson_features

router = APIRouter(prefix="/parcels", tags=["parcels"])

RC_RE = re.compile(r"^[0-9A-Z]{14,20}$")
COLOR_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
DEFAULT_COLOR = "#7c3aed"


class ParcelLookupRequest(BaseModel):
    cadastral_ref: str = Field(min_length=14, max_length=20)


class ParcelIdentifyRequest(BaseModel):
    longitude: float = Field(ge=-19.0, le=5.0)
    latitude: float = Field(ge=27.0, le=45.0)


class ParcelUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=160)
    color: str | None = None
    group_id: str | None = None
    is_deleted: bool | None = None


def _normalise_rc(value: str) -> str:
    rc = "".join(value.split()).upper()
    if not RC_RE.fullmatch(rc):
        raise HTTPException(
            status_code=400,
            detail="La referencia catastral debe contener entre 14 y 20 caracteres alfanuméricos",
        )
    return rc


def _extract_cadastral_ref(properties: dict[str, Any]) -> str | None:
    """Find the cadastral reference in GDAL-flattened INSPIRE properties."""

    preferred_keys = ("nationalcadastralreference", "localid")
    normalised = {
        re.sub(r"[^a-z0-9]", "", str(key).lower()): value
        for key, value in properties.items()
    }

    for key in preferred_keys:
        value = normalised.get(key)
        if value is None:
            continue
        candidate = "".join(str(value).split()).upper()
        if RC_RE.fullmatch(candidate):
            return candidate

    # Different GDAL/GML driver versions can prefix namespace names. As a
    # defensive fallback, inspect all scalar property values for a valid RC.
    for value in properties.values():
        if isinstance(value, (str, int)):
            candidate = "".join(str(value).split()).upper()
            if RC_RE.fullmatch(candidate):
                return candidate

    return None


def _catastro_error_is_rate_limit(message: str) -> bool:
    lowered = message.lower()
    return (
        "limite de peticiones" in lowered
        or "límite de peticiones" in lowered
        or "peticion denegada" in lowered
        or "petición denegada" in lowered
    )


def _row_to_feature(row: Any, *, source: str | None = None) -> dict[str, Any]:
    properties: dict[str, Any] = {
        "cadastral_ref": row["cadastral_ref"],
        "name": row["name"],
        "color": row["color"],
        "group_id": str(row["group_id"]) if row["group_id"] else None,
        "is_deleted": row["is_deleted"],
    }
    if source:
        properties["source"] = source

    return {
        "type": "Feature",
        "geometry": json.loads(row["geom"]),
        "properties": properties,
    }


@router.post("/identify")
async def identify_parcel(payload: ParcelIdentifyRequest) -> dict[str, Any]:
    """Identify the cadastral parcel underneath a map click without saving it."""

    point_wkt = f"POINT({payload.longitude} {payload.latitude})"

    # Saved parcels are resolved locally first. This makes repeated clicks instant
    # and avoids spending Catastro WFS requests unnecessarily.
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT
                    cadastral_ref,
                    name,
                    color,
                    group_id,
                    is_deleted,
                    ST_AsGeoJSON(geom_official) AS geom
                FROM parcels
                WHERE ST_Covers(
                    geom_official,
                    ST_GeomFromText(:point_wkt, 4326)
                )
                ORDER BY is_deleted ASC, updated_at DESC
                LIMIT 1
                """
            ),
            {"point_wkt": point_wkt},
        ).mappings().first()

    if row:
        return {
            "parcel": _row_to_feature(row, source="db"),
            "already_saved": True,
        }

    if is_denied():
        raise HTTPException(
            status_code=503,
            detail=(
                "Catastro está bloqueado temporalmente por rate-limit. "
                f"Reintenta en ~{remaining_seconds()}s. Motivo: {deny_reason()}"
            ),
        )

    try:
        xml_text, srs_used = await fetch_parcels_around_point_gml(
            payload.longitude,
            payload.latitude,
        )
        features = gml_text_to_geojson_features(xml_text)
    except Exception as exc:
        message = str(exc)
        if _catastro_error_is_rate_limit(message):
            deny_for(60 * 60, "Límite de peticiones por hora (Catastro)")
            raise HTTPException(
                status_code=503,
                detail="Catastro ha limitado temporalmente las consultas desde el mapa",
            ) from exc
        if "sin features" in message.lower():
            raise HTTPException(status_code=404, detail="No se encontró una parcela en ese punto") from exc
        raise HTTPException(status_code=502, detail=f"Error identificando parcela en Catastro: {exc}") from exc

    click_point = Point(payload.longitude, payload.latitude)
    matches: list[tuple[float, dict[str, Any], str]] = []

    for feature in features:
        geometry = feature.get("geometry")
        if not geometry:
            continue
        try:
            polygon = shape(geometry)
        except Exception:
            continue
        if polygon.is_empty or not polygon.covers(click_point):
            continue

        rc = _extract_cadastral_ref(feature.get("properties") or {})
        if not rc:
            continue
        matches.append((polygon.area, feature, rc))

    if not matches:
        raise HTTPException(
            status_code=404,
            detail="No se pudo identificar una parcela exactamente bajo ese punto",
        )

    # A click on a shared boundary can technically match more than one feature.
    # The smallest covering polygon is the least surprising choice for selection.
    _, feature, rc = min(matches, key=lambda item: item[0])

    with engine.begin() as conn:
        saved_row = conn.execute(
            text(
                """
                SELECT cadastral_ref, name, color, group_id, is_deleted,
                       ST_AsGeoJSON(geom_official) AS geom
                FROM parcels
                WHERE cadastral_ref = :rc OR LEFT(cadastral_ref, 14) = :rc14
                ORDER BY (cadastral_ref = :rc) DESC, updated_at DESC
                LIMIT 1
                """
            ),
            {"rc": rc, "rc14": rc[:14]},
        ).mappings().first()

    if saved_row:
        return {
            "parcel": _row_to_feature(saved_row, source="db"),
            "already_saved": True,
        }

    feature["properties"] = {
        "cadastral_ref": rc,
        "name": None,
        "color": "#f59e0b",
        "group_id": None,
        "is_deleted": False,
        "source": "catastro_wfs_bbox",
        "srs_in": srs_used,
    }
    return {"parcel": feature, "already_saved": False}


@router.post("/lookup")
async def lookup_parcel(payload: ParcelLookupRequest) -> dict[str, Any]:
    rc = _normalise_rc(payload.cadastral_ref)
    rc14 = rc[:14]

    # Prefer the exact reference but accept an already cached 20-char variant for
    # a 14-char search. This avoids unnecessary calls to Catastro.
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT
                    cadastral_ref,
                    name,
                    color,
                    group_id,
                    is_deleted,
                    ST_AsGeoJSON(geom_official) AS geom
                FROM parcels
                WHERE cadastral_ref = :rc OR LEFT(cadastral_ref, 14) = :rc14
                ORDER BY (cadastral_ref = :rc) DESC, updated_at DESC
                LIMIT 1
                """
            ),
            {"rc": rc, "rc14": rc14},
        ).mappings().first()

    if row:
        return {"parcel": _row_to_feature(row, source="db")}

    if is_denied():
        raise HTTPException(
            status_code=503,
            detail=(
                "Catastro está bloqueado temporalmente por rate-limit. "
                f"Reintenta en ~{remaining_seconds()}s. Motivo: {deny_reason()}"
            ),
        )

    try:
        xml_text, srs_used = await fetch_parcel_gml(rc14)
    except Exception as exc:
        message = str(exc)
        if (
            "Ha superado el limite de peticiones por hora" in message
            or "Peticion denegada" in message
            or "Petición denegada" in message
        ):
            deny_for(60 * 60, "Límite de peticiones por hora (Catastro)")
            raise HTTPException(
                status_code=503,
                detail=(
                    "Catastro ha denegado la petición por límite horario. "
                    "Las llamadas externas quedan pausadas durante 60 minutos."
                ),
            ) from exc
        raise HTTPException(status_code=502, detail=f"Error llamando WFS Catastro: {exc}") from exc

    try:
        feature = gml_text_to_geojson_feature(xml_text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error convirtiendo GML a GeoJSON: {exc}") from exc

    if not feature.get("geometry"):
        raise HTTPException(status_code=502, detail="Catastro devolvió una parcela sin geometría")

    geom_json = json.dumps(feature["geometry"])
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO parcels (
                    cadastral_ref,
                    geom_official,
                    color,
                    is_deleted,
                    last_fetched_at,
                    updated_at
                )
                VALUES (
                    :rc,
                    ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:geom), 4326)),
                    :color,
                    FALSE,
                    NOW(),
                    NOW()
                )
                ON CONFLICT (cadastral_ref) DO UPDATE
                SET
                    geom_official = EXCLUDED.geom_official,
                    last_fetched_at = EXCLUDED.last_fetched_at,
                    updated_at = NOW()
                """
            ),
            {"rc": rc, "geom": geom_json, "color": DEFAULT_COLOR},
        )

    feature["properties"] = {
        **feature.get("properties", {}),
        "cadastral_ref": rc,
        "name": None,
        "color": DEFAULT_COLOR,
        "group_id": None,
        "is_deleted": False,
        "source": "catastro_wfs_gml",
        "srs_in": srs_used,
    }
    return {"parcel": feature}


@router.get("")
def list_parcels(include_deleted: bool = Query(False)) -> dict[str, Any]:
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT
                    cadastral_ref,
                    name,
                    color,
                    group_id,
                    is_deleted,
                    ST_AsGeoJSON(geom_official) AS geom
                FROM parcels
                WHERE (:include_deleted = TRUE OR is_deleted = FALSE)
                ORDER BY updated_at DESC, cadastral_ref ASC
                """
            ),
            {"include_deleted": include_deleted},
        ).mappings().all()

    return {
        "type": "FeatureCollection",
        "features": [_row_to_feature(row) for row in rows],
    }


@router.patch("/{rc}")
def update_parcel(rc: str, payload: ParcelUpdateRequest) -> dict[str, bool]:
    normalised_rc = _normalise_rc(rc)

    color = payload.color.strip().lower() if payload.color is not None else None
    if color is not None and not COLOR_RE.fullmatch(color):
        raise HTTPException(status_code=400, detail="color debe tener formato #RRGGBB")

    group_id = payload.group_id
    if group_id:
        try:
            group_id = str(uuid.UUID(group_id))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="group_id inválido") from exc

    if group_id:
        with engine.begin() as conn:
            group_exists = conn.execute(
                text("SELECT 1 FROM parcel_groups WHERE id = CAST(:id AS uuid)"),
                {"id": group_id},
            ).scalar_one_or_none()
        if group_exists is None:
            raise HTTPException(status_code=400, detail="El grupo indicado no existe")

    name = payload.name.strip() if payload.name is not None else None

    with engine.begin() as conn:
        result = conn.execute(
            text(
                """
                UPDATE parcels
                SET
                    name = CASE WHEN :name_is_set THEN :name ELSE name END,
                    color = COALESCE(:color, color),
                    group_id = CASE
                        WHEN :group_id_is_set THEN CAST(NULLIF(:group_id, '') AS uuid)
                        ELSE group_id
                    END,
                    is_deleted = COALESCE(:is_deleted, is_deleted),
                    deleted_at = CASE
                        WHEN COALESCE(:is_deleted, is_deleted) = TRUE THEN COALESCE(deleted_at, NOW())
                        ELSE NULL
                    END,
                    updated_at = NOW()
                WHERE cadastral_ref = :rc
                   OR (:allow_rc14_fallback = TRUE AND LEFT(cadastral_ref, 14) = :rc14)
                """
            ),
            {
                "rc": normalised_rc,
                "rc14": normalised_rc[:14],
                "allow_rc14_fallback": len(normalised_rc) == 14,
                "name_is_set": "name" in payload.model_fields_set,
                "name": name,
                "color": color,
                "group_id_is_set": "group_id" in payload.model_fields_set,
                "group_id": group_id if group_id is not None else "",
                "is_deleted": payload.is_deleted,
            },
        )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Parcela no encontrada")

    return {"ok": True}


@router.delete("/{rc}")
def soft_delete_parcel(rc: str) -> dict[str, bool]:
    normalised_rc = _normalise_rc(rc)

    with engine.begin() as conn:
        result = conn.execute(
            text(
                """
                UPDATE parcels
                SET is_deleted = TRUE, deleted_at = NOW(), updated_at = NOW()
                WHERE cadastral_ref = :rc
                   OR (:allow_rc14_fallback = TRUE AND LEFT(cadastral_ref, 14) = :rc14)
                """
            ),
            {
                "rc": normalised_rc,
                "rc14": normalised_rc[:14],
                "allow_rc14_fallback": len(normalised_rc) == 14,
            },
        )

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Parcela no encontrada")

    return {"ok": True}
