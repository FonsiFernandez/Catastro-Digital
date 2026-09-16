from __future__ import annotations

import time
from collections import OrderedDict
from threading import BoundedSemaphore, Lock

import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response


router = APIRouter(prefix="/wms", tags=["wms"])


CATASTRO_WMS_BASE = (
    "https://ovc.catastro.meh.es/"
    "cartografia/INSPIRE/spadgcwms.aspx"
)

CACHE_MAX_ITEMS = 1500
CACHE_TTL_SECONDS = 24 * 3600

# Do not hammer the official Catastro WMS with all MapLibre
# tile requests at the same time.
MAX_CONCURRENT_CATASTRO_REQUESTS = 4

# Initial request + retries.
MAX_ATTEMPTS = 3

RETRYABLE_STATUS_CODES = {
    429,
    500,
    502,
    503,
    504,
}


_cache: OrderedDict[
    str,
    tuple[float, str, bytes],
] = OrderedDict()

_cache_lock = Lock()

_catastro_slots = BoundedSemaphore(
    MAX_CONCURRENT_CATASTRO_REQUESTS
)


# Reuse TCP/TLS connections instead of creating one httpx.Client
# for every single raster tile.
_http_client = httpx.Client(
    timeout=httpx.Timeout(
        connect=5.0,
        read=20.0,
        write=10.0,
        pool=10.0,
    ),
    follow_redirects=True,
    limits=httpx.Limits(
        max_connections=8,
        max_keepalive_connections=4,
        keepalive_expiry=30.0,
    ),
    headers={
        "User-Agent": "Catastro-Digital/1.0",
        "Accept": "image/png,image/*;q=0.9,*/*;q=0.8",
    },
)


def _cache_get(
        key: str,
) -> tuple[str, bytes] | None:
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


def _cache_put(
        key: str,
        content_type: str,
        content: bytes,
) -> None:
    with _cache_lock:
        _cache[key] = (
            time.time(),
            content_type,
            content,
        )

        _cache.move_to_end(key)

        while len(_cache) > CACHE_MAX_ITEMS:
            _cache.popitem(last=False)


def _get_catastro_tile(
        params: dict[str, str],
) -> tuple[str, bytes]:
    last_error: Exception | None = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            with _catastro_slots:
                response = _http_client.get(
                    CATASTRO_WMS_BASE,
                    params=params,
                )

            if (
                    response.status_code
                    in RETRYABLE_STATUS_CODES
            ):
                raise httpx.HTTPStatusError(
                    (
                        "Catastro WMS returned "
                        f"{response.status_code}"
                    ),
                    request=response.request,
                    response=response,
                )

            response.raise_for_status()

            content = response.content

            if not content:
                raise RuntimeError(
                    "Catastro WMS devolvió una respuesta vacía"
                )

            content_type = (
                    response.headers.get("Content-Type")
                    or "image/png"
            )

            # WMS servers can sometimes return an XML exception
            # with HTTP 200. Never cache that as if it were a tile.
            if not content_type.lower().startswith("image/"):
                preview = content[:500].decode(
                    "utf-8",
                    errors="replace",
                )

                raise RuntimeError(
                    "Catastro WMS devolvió contenido no válido "
                    f"({content_type}): {preview}"
                )

            return content_type, content

        except (
                httpx.TimeoutException,
                httpx.NetworkError,
                httpx.HTTPStatusError,
                RuntimeError,
        ) as exc:
            last_error = exc

            if attempt >= MAX_ATTEMPTS:
                break

            # Small progressive backoff:
            # 0.35 s, then 0.70 s.
            time.sleep(0.35 * attempt)

    raise RuntimeError(
        f"Catastro WMS failed after {MAX_ATTEMPTS} attempts: "
        f"{last_error}"
    )


@router.get("/catastro")
def catastro_wms_tile(
        bbox: str = Query(
            ...,
            description=(
                    "BBOX EPSG:3857: minx,miny,maxx,maxy"
            ),
        ),
        width: int = Query(
            512,
            ge=1,
            le=2048,
        ),
        height: int = Query(
            512,
            ge=1,
            le=2048,
        ),
) -> Response:
    layers = "CP.CadastralParcel"
    styles = "CP.CadastralParcel.BoundariesOnly"
    image_format = "image/png"
    crs = "EPSG:3857"

    cache_key = (
        f"catastro|{layers}|{styles}|{crs}|"
        f"{width}x{height}|{bbox}"
    )

    cached = _cache_get(cache_key)

    if cached:
        content_type, content = cached

        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Cache-Control": (
                    "public, max-age=86400"
                ),
                "X-Cache": "HIT",
            },
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
        content_type, content = _get_catastro_tile(
            params
        )

        _cache_put(
            cache_key,
            content_type,
            content,
        )

        return Response(
            content=content,
            media_type=content_type,
            headers={
                "Cache-Control": (
                    "public, max-age=86400"
                ),
                "X-Cache": "MISS",
            },
        )

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=(
                "Error proxy WMS Catastro: "
                f"{type(exc).__name__}: {exc}"
            ),
        ) from exc