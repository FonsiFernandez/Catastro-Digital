import httpx

WFS_BASE = "https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx"
SRS_CANDIDATES = ["EPSG::25829", "EPSG::25830", "EPSG::25831"]

async def fetch_parcel_gml(refcat14: str) -> tuple[str, str]:
    """
    Devuelve (xml_gml, srs_usado). Lanza excepción si no hay respuesta válida.
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        last_text = ""
        for srs in SRS_CANDIDATES:
            params = {
                "service": "WFS",
                "version": "2.0.0",
                "request": "GetFeature",
                "STOREDQUERIE_ID": "GetParcel",
                "refcat": refcat14,
                "srsname": srs,
                # NO outputFormat -> Catastro devuelve GML/XML
            }
            r = await client.get(WFS_BASE, params=params)
            last_text = r.text
            if r.status_code == 200 and last_text.lstrip().startswith("<?xml"):
                return (last_text, srs)

        raise RuntimeError(f"WFS no respondió GML válido. Última respuesta: {last_text[:200]}")
