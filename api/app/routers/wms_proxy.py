from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
import urllib.request
import urllib.parse
import time
from collections import OrderedDict
from threading import Lock

router = APIRouter(prefix="/wms", tags=["wms"])

CATASTRO_WMS_BASE = "https://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx"

# ---- Cache settings ----
CACHE_MAX_ITEMS = 1500          # ajustable (memoria vs rendimiento)
CACHE_TTL_SECONDS = 24 * 3600   # 24h

# key -> (ts, content_type, bytes)
_cache: "OrderedDict[str, tuple[float, str, bytes]]" = OrderedDict()
_cache_lock = Lock()


def _cache_get(key: str):
    now = time.time()
    with _cache_lock:
        item = _cache.get(key)
        if not item:
            return None
        ts, ctype, content = item
        if now - ts > CACHE_TTL_SECONDS:
            # expirado
            try:
                del _cache[key]
            except KeyError:
                pass
            return None
        # LRU bump
        _cache.move_to_end(key, last=True)
        return ctype, content


def _cache_put(key: str, ctype: str, content: bytes):
    now = time.time()
    with _cache_lock:
        _cache[key] = (now, ctype, content)
        _cache.move_to_end(key, last=True)

        # Evict LRU
        while len(_cache) > CACHE_MAX_ITEMS:
            _cache.popitem(last=False)


@router.get("/catastro")
def catastro_wms_tile(
        bbox: str = Query(..., description="BBOX en EPSG:3857: minx,miny,maxx,maxy"),
        width: int = Query(512, ge=1, le=2048),
        height: int = Query(512, ge=1, le=2048),
):
    # Construye key de cache (incluye todo lo que cambia el resultado)
    # Nota: si cambias layers/styles, deben entrar en la key.
    layers = "CP.CadastralParcel"
    styles = "CP.CadastralParcel.BoundariesOnly"
    fmt = "image/png"
    crs = "EPSG:3857"

    cache_key = f"catastro|{layers}|{styles}|{fmt}|{crs}|{width}x{height}|{bbox}"

    cached = _cache_get(cache_key)
    if cached:
        ctype, content = cached
        return Response(
            content=content,
            media_type=ctype,
            headers={
                # cache en navegador (opcional)
                "Cache-Control": "public, max-age=3600",
                "X-Cache": "HIT",
            },
        )

    params = {
        "service": "WMS",
        "request": "GetMap",
        "version": "1.3.0",
        "layers": layers,
        "styles": styles,
        "format": fmt,
        "transparent": "true",
        "crs": crs,
        "bbox": bbox,
        "width": str(width),
        "height": str(height),
    }

    url = f"{CATASTRO_WMS_BASE}?{urllib.parse.urlencode(params)}"

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "cadweb/1.0",
                "Accept": "image/png,image/*;q=0.9,*/*;q=0.8",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            content = resp.read()
            ctype = resp.headers.get("Content-Type", fmt) or fmt

        # Guardar en cache (solo si parece una imagen válida)
        if content and len(content) > 0:
            _cache_put(cache_key, ctype, content)

        return Response(
            content=content,
            media_type=ctype,
            headers={
                "Cache-Control": "public, max-age=3600",
                "X-Cache": "MISS",
            },
        )

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error proxy WMS Catastro: {e}")
