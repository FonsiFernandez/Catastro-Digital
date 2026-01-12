from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
import json

from app.db import engine
from app.services.catastro_wfs import fetch_parcel_gml
from app.services.gml_to_geojson import gml_text_to_geojson_feature

router = APIRouter(prefix="/parcels", tags=["parcels"])


class ParcelLookupRequest(BaseModel):
    cadastral_ref: str


@router.post("/lookup")
async def lookup_parcel(payload: ParcelLookupRequest):
    rc20 = payload.cadastral_ref.strip().upper()
    rc14 = rc20[:14]

    # 1) DB cache
    with engine.begin() as conn:
        row = conn.execute(
            text(
                "SELECT cadastral_ref, ST_AsGeoJSON(geom_official) AS geom "
                "FROM parcels WHERE cadastral_ref=:rc"
            ),
            {"rc": rc20},
        ).mappings().first()

        if row:
            return {
                "parcel": {
                    "type": "Feature",
                    "geometry": json.loads(row["geom"]),
                    "properties": {"cadastral_ref": row["cadastral_ref"], "source": "db"},
                }
            }

    # 2) Catastro WFS (GML/XML)
    try:
        xml_text, srs_used = await fetch_parcel_gml(rc14)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error llamando WFS Catastro: {e}")

    # 3) Convertir a GeoJSON y reproyectar a EPSG:4326
    try:
        feature = gml_text_to_geojson_feature(xml_text)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error convirtiendo GML a GeoJSON: {e}")

    if not feature.get("geometry"):
        raise HTTPException(status_code=502, detail="GeoJSON sin geometría tras conversión")

    # 4) Guardar en PostGIS
    geom_json = json.dumps(feature["geometry"])
    with engine.begin() as conn:
        conn.execute(
            text("""
                 INSERT INTO parcels (cadastral_ref, geom_official)
                 VALUES (:rc, ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(:g), 4326)))
                     ON CONFLICT (cadastral_ref) DO UPDATE
                                                        SET geom_official = EXCLUDED.geom_official
                 """),
        {"rc": rc20, "g": geom_json},
        )

    feature["properties"] = feature.get("properties", {})
    feature["properties"]["cadastral_ref"] = rc20
    feature["properties"]["source"] = "catastro_wfs_gml"
    feature["properties"]["srs_in"] = srs_used

    return {"parcel": feature}
