from __future__ import annotations

import math

import httpx

WFS_BASE = "https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx"
SRS_CANDIDATES = ("EPSG::25829", "EPSG::25830", "EPSG::25831")
WEB_MERCATOR_SRS = "EPSG:3857"


def _is_gml_response(status_code: int, text: str) -> bool:
    stripped = text.lstrip()
    return status_code == 200 and (
        stripped.startswith("<?xml")
        or stripped.startswith("<wfs:")
        or stripped.startswith("<gml:")
    )


def _is_rate_limited(text: str) -> bool:
    return (
        "Ha superado el limite de peticiones por hora" in text
        or "Peticion denegada" in text
        or "Petición denegada" in text
    )


async def fetch_parcel_gml(refcat14: str) -> tuple[str, str]:
    """Fetch a cadastral parcel as GML, trying Spain's UTM zones."""

    timeout = httpx.Timeout(30.0, connect=10.0)
    headers = {
        "User-Agent": "Catastro-Digital/1.0",
        "Accept": "application/xml,text/xml,*/*;q=0.8",
    }

    async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
        last_text = ""
        last_status = 0

        for srs in SRS_CANDIDATES:
            params = {
                "service": "WFS",
                "version": "2.0.0",
                "request": "GetFeature",
                "STOREDQUERIE_ID": "GetParcel",
                "refcat": refcat14,
                "srsname": srs,
            }
            response = await client.get(WFS_BASE, params=params)
            last_status = response.status_code
            last_text = response.text
            if _is_rate_limited(last_text):
                continue

            if _is_gml_response(response.status_code, last_text):
                return last_text, srs

        preview = " ".join(last_text[:240].split())
        raise RuntimeError(
            f"WFS no respondió GML válido (HTTP {last_status}). Última respuesta: {preview}"
        )


def _lonlat_to_web_mercator(longitude: float, latitude: float) -> tuple[float, float]:
    """Convert WGS84 lon/lat to EPSG:3857 without an extra projection dependency."""

    latitude = max(min(latitude, 85.05112878), -85.05112878)
    origin_shift = 20037508.342789244
    x = longitude * origin_shift / 180.0
    y = math.log(math.tan((90.0 + latitude) * math.pi / 360.0)) / (math.pi / 180.0)
    y = y * origin_shift / 180.0
    return x, y


async def fetch_parcels_around_point_gml(
    longitude: float,
    latitude: float,
    *,
    radius_m: float = 90.0,
) -> tuple[str, str]:
    """Fetch cadastral parcels around a clicked WGS84 point.

    Catastro limits CP:CadastralParcel BBOX requests to 1 km². A 180 m × 180 m
    box is comfortably below that limit and large enough to include the clicked
    parcel in normal urban and rural use.
    """

    x, y = _lonlat_to_web_mercator(longitude, latitude)
    bbox = f"{x - radius_m:.3f},{y - radius_m:.3f},{x + radius_m:.3f},{y + radius_m:.3f}"

    timeout = httpx.Timeout(30.0, connect=10.0)
    headers = {
        "User-Agent": "Catastro-Digital/1.0",
        "Accept": "application/xml,text/xml,*/*;q=0.8",
    }
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typenames": "cp.cadastralparcel",
        "srsname": WEB_MERCATOR_SRS,
        "bbox": bbox,
    }

    async with httpx.AsyncClient(timeout=timeout, headers=headers, follow_redirects=True) as client:
        response = await client.get(WFS_BASE, params=params)
        text = response.text

    if _is_rate_limited(text):
        raise RuntimeError("Catastro ha denegado temporalmente la consulta WFS")

    if not _is_gml_response(response.status_code, text):
        preview = " ".join(text[:240].split())
        raise RuntimeError(
            f"WFS BBOX no respondió GML válido (HTTP {response.status_code}). Respuesta: {preview}"
        )

    return text, WEB_MERCATOR_SRS
