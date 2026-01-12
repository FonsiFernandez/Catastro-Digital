from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
import urllib.request
import urllib.parse

router = APIRouter(prefix="/wms", tags=["wms"])

CATASTRO_WMS_BASE = "https://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx"

@router.get("/catastro")
def catastro_wms_tile(
        bbox: str = Query(..., description="BBOX en EPSG:3857: minx,miny,maxx,maxy"),
        width: int = Query(512, ge=1, le=2048),
        height: int = Query(512, ge=1, le=2048),
):
    # Construimos la URL del WMS (servidor->servidor, sin CORS)
    params = {
        "service": "WMS",
        "request": "GetMap",
        "version": "1.3.0",
        "layers": "CP.CadastralParcel",
        "styles": "CP.CadastralParcel.BoundariesOnly",
        "format": "image/png",
        "transparent": "true",
        "crs": "EPSG:3857",
        "bbox": bbox,
        "width": str(width),
        "height": str(height),
    }

    url = f"{CATASTRO_WMS_BASE}?{urllib.parse.urlencode(params)}"

    try:
        req = urllib.request.Request(
            url,
            headers={
                # A veces ayuda a evitar bloqueos tontos
                "User-Agent": "cadweb/1.0",
                "Accept": "image/png,image/*;q=0.9,*/*;q=0.8",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            content = resp.read()
            ctype = resp.headers.get("Content-Type", "image/png")
            return Response(content=content, media_type=ctype)

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error proxy WMS Catastro: {e}")
