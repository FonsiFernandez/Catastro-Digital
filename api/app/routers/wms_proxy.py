from __future__ import annotations

import time
from collections import OrderedDict
from threading import Lock

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

router = APIRouter(prefix="/wms", tags=["wms"])

CATASTRO_WMS_BASE = "https://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx"
CACHE_MAX_ITEMS = 1500
CACHE_TTL_SECONDS = 24 * 3600

_cache: OrderedDict[str, tuple[float, str, bytes]] = OrderedDict()
_cache_lock = Lock()


def _cache_get(key: str) -> tuple[str, bytes] | None:
    now = time.time()
    with _cache_lock:
        item = _cache.get(key)
        if item is None:
            return None
        timestamp, content_type, content = item
        if now - timestamp > CACHE_TTL_SECONDS:
            _cache.pop(key, None)
            return None
        _cache.move_to_end(key)
        return content_type, content


def _cache_put(key: str, content_type: str, content: bytes) -> None:
    with _cache_lock:
        _cache[key] = (time.time(), content_type, content)
        _cache.move_to_end(key)
        while len(_cache) > CACHE_MAX_ITEMS:
            _cache.popitem(last=False)


@router.get("/catastro")
def catastro_wms_tile(
    bbox: str = Query(..., description="BBOX EPSG:3857: minx,miny,maxx,maxy"),
    width: int = Query(512, ge=1, le=2048),
    height: int = Query(512, ge=1, le=2048),
) -> Response:
    layers = "CP.CadastralParcel"
    styles = "CP.CadastralParcel.BoundariesOnly"
    image_format = "image/png"
    crs = "EPSG:3857"
    cache_key = f"catastro|{layers}|{styles}|{crs}|{width}x{height}|{bbox}"

    cached = _cache_get(cache_key)
    if cached:
        content_type, content = cached
        return Response(
            content=content,
            media_type=content_type,
            headers={"Cache-Control": "public, max-age=3600", "X-Cache": "HIT"},
        )

    params = {
        "service": "WMS",
        "request": "GetMap",
        "version": "1.3.0",
        "layers": layers,
        "styles": styles,
        "format": image_format,
        "transparent": "true",
        "crs": crs,
        "bbox": bbox,
        "width": str(width),
        "height": str(height),
    }

    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as client:
            response = client.get(
                CATASTRO_WMS_BASE,
                params=params,
                headers={
                    "User-Agent": "Catastro-Digital/1.0",
                    "Accept": "image/png,image/*;q=0.9,*/*;q=0.8",
                },
            )
            response.raise_for_status()
            content = response.content
            content_type = response.headers.get("Content-Type", image_format) or image_format

        if not content:
            raise RuntimeError("respuesta vacía")

        _cache_put(cache_key, content_type, content)
        return Response(
            content=content,
            media_type=content_type,
            headers={"Cache-Control": "public, max-age=3600", "X-Cache": "MISS"},
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Error proxy WMS Catastro: {exc}") from exc
