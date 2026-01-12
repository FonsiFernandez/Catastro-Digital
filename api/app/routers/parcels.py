from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
import json
from typing import Optional

from app.db import engine
from app.services.catastro_wfs import fetch_parcel_gml
from app.services.gml_to_geojson import gml_text_to_geojson_feature
from app.services.catastro_circuit import is_denied, remaining_seconds, reason as deny_reason
from app.services.catastro_circuit import deny_for

router = APIRouter(prefix="/parcels", tags=["parcels"])


class ParcelLookupRequest(BaseModel):
    cadastral_ref: str


class ParcelUpdateRequest(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None       # "#RRGGBB"
    group_id: Optional[str] = None    # uuid string o "" para quitar
    is_deleted: Optional[bool] = None # true/false para soft delete/restore


@router.post("/lookup")
async def lookup_parcel(payload: ParcelLookupRequest):
    rc20 = payload.cadastral_ref.strip().upper()
    rc14 = rc20[:14]

    # 1) DB cache (incluye borradas -> NO consume Catastro)
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
                WHERE cadastral_ref=:rc
                """
            ),
            {"rc": rc20},
        ).mappings().first()

        if row:
            return {
                "parcel": {
                    "type": "Feature",
                    "geometry": json.loads(row["geom"]),
                    "properties": {
                        "cadastral_ref": row["cadastral_ref"],
                        "name": row["name"],
                        "color": row["color"],
                        "group_id": str(row["group_id"]) if row["group_id"] else None,
                        "is_deleted": row["is_deleted"],
                        "source": "db",
                    },
                }
            }

    if is_denied():
        raise HTTPException(
            status_code=503,
            detail=f"Catastro bloqueado temporalmente por rate-limit. Reintenta en ~{remaining_seconds()}s. Motivo: {deny_reason()}",
    )

    # 2) Catastro WFS (GML/XML)
    try:
        xml_text, srs_used = await fetch_parcel_gml(rc14)
    except Exception as e:
        msg = str(e)
        if "Ha superado el limite de peticiones por hora" in msg or "Peticion denegada" in msg:
            deny_for(60 * 60, "Límite de peticiones por hora (Catastro)")
            raise HTTPException(
                status_code=503,
                detail="Catastro ha denegado por límite de peticiones por hora. He bloqueado llamadas externas durante 60 minutos para no gastar más intentos.",
            )
        raise HTTPException(status_code=502, detail=f"Error llamando WFS Catastro: {e}")

    # 3) Convertir a GeoJSON y reproyectar a EPSG:4326
    try:
        feature = gml_text_to_geojson_feature(xml_text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error convirtiendo GML a GeoJSON: {e}")

    if not feature.get("geometry"):
        raise HTTPException(status_code=502, detail="GeoJSON sin geometría tras conversión")

    default_color = "#ff0000"

    # 4) Guardar en PostGIS (cache: para no consumir Catastro en el futuro)
    geom_json = json.dumps(feature["geometry"])
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                INSERT INTO parcels (cadastral_ref, geom_official, color, is_deleted, last_fetched_at)
                VALUES (:rc, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:g), 4326)), :color, false, now())
                    ON CONFLICT (cadastral_ref) DO UPDATE
                                                       SET
                                                           geom_official = EXCLUDED.geom_official,
                                                       last_fetched_at = EXCLUDED.last_fetched_at
                """
            ),
            {"rc": rc20, "g": geom_json, "color": default_color},
        )

    feature["properties"] = feature.get("properties", {})
    feature["properties"]["cadastral_ref"] = rc20
    feature["properties"]["name"] = None
    feature["properties"]["color"] = default_color
    feature["properties"]["group_id"] = None
    feature["properties"]["is_deleted"] = False
    feature["properties"]["source"] = "catastro_wfs_gml"
    feature["properties"]["srs_in"] = srs_used

    return {"parcel": feature}


@router.get("")
def list_parcels(include_deleted: bool = Query(False)):
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
                WHERE (:include_deleted = true OR is_deleted = false)
                ORDER BY updated_at DESC
                """
            ),
            {"include_deleted": include_deleted},
        ).mappings().all()

    features = []
    for r in rows:
        features.append(
            {
                "type": "Feature",
                "geometry": json.loads(r["geom"]),
                "properties": {
                    "cadastral_ref": r["cadastral_ref"],
                    "name": r["name"],
                    "color": r["color"],
                    "group_id": str(r["group_id"]) if r["group_id"] else None,
                    "is_deleted": r["is_deleted"],
                },
            }
        )

    return {"type": "FeatureCollection", "features": features}


@router.patch("/{rc}")
def update_parcel(rc: str, payload: ParcelUpdateRequest):
    rc = rc.strip().upper()

    if payload.color is not None:
        c = payload.color.strip()
        if not (len(c) == 7 and c.startswith("#")):
            raise HTTPException(status_code=400, detail="color debe ser formato #RRGGBB")

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE parcels
                SET
                    name = COALESCE(:name, name),
                    color = COALESCE(:color, color),
                    group_id = CASE
                                   WHEN :group_id_is_set = true THEN NULLIF(:group_id, '')::uuid
                                   ELSE group_id
                        END,
                    is_deleted = COALESCE(:is_deleted, is_deleted),
                    deleted_at = CASE
                                     WHEN COALESCE(:is_deleted, is_deleted) = true THEN COALESCE(deleted_at, now())
                                     ELSE NULL
                        END
                WHERE cadastral_ref = :rc
                """
            ),
            {
                "rc": rc,
                "name": payload.name,
                "color": payload.color,
                "group_id_is_set": payload.group_id is not None,
                "group_id": payload.group_id,
                "is_deleted": payload.is_deleted,
            },
        )

    return {"ok": True}


@router.delete("/{rc}")
def soft_delete_parcel(rc: str):
    rc = rc.strip().upper()
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                UPDATE parcels
                SET is_deleted = true, deleted_at = now()
                WHERE cadastral_ref = :rc
                """
            ),
            {"rc": rc},
        )
    return {"ok": True}
