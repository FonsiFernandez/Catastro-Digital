from __future__ import annotations

import httpx

WFS_BASE = "https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx"
SRS_CANDIDATES = ("EPSG::25829", "EPSG::25830", "EPSG::25831")


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
            stripped = last_text.lstrip()
            if (
                "Ha superado el limite de peticiones por hora" in last_text
                or "Peticion denegada" in last_text
                or "Petición denegada" in last_text
            ):
                continue

            if response.status_code == 200 and (
                stripped.startswith("<?xml") or stripped.startswith("<wfs:")
            ):
                return last_text, srs

        preview = " ".join(last_text[:240].split())
        raise RuntimeError(
            f"WFS no respondió GML válido (HTTP {last_status}). Última respuesta: {preview}"
        )
