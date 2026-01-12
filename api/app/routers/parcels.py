from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/parcels", tags=["parcels"])


class ParcelLookupRequest(BaseModel):
    cadastral_ref: str


@router.post("/lookup")
def lookup_parcel(payload: ParcelLookupRequest):
    # GeoJSON de prueba (polígono cerca de Madrid)
    geojson = {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[
                [-3.705, 40.417],
                [-3.700, 40.417],
                [-3.700, 40.414],
                [-3.705, 40.414],
                [-3.705, 40.417]
            ]]
        },
        "properties": {
            "cadastral_ref": payload.cadastral_ref,
            "surface_m2": 1200,
            "source": "mock"
        }
    }

    return {
        "parcel": geojson
    }
