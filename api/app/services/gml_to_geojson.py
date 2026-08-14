from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path
from typing import Any


def gml_text_to_geojson_feature(xml_text: str) -> dict[str, Any]:
    """Convert Catastro GML to a WGS84 GeoJSON feature using GDAL/ogr2ogr."""

    with tempfile.TemporaryDirectory() as tmpdir:
        in_path = Path(tmpdir) / "parcel.gml"
        in_path.write_text(xml_text, encoding="latin-1", errors="ignore")

        command = [
            "ogr2ogr",
            "-f",
            "GeoJSON",
            "/vsistdout/",
            str(in_path),
            "-t_srs",
            "EPSG:4326",
        ]

        try:
            output = subprocess.check_output(
                command,
                stderr=subprocess.STDOUT,
                timeout=30,
            )
        except subprocess.CalledProcessError as exc:
            detail = exc.output.decode("utf-8", errors="ignore")[:500]
            raise RuntimeError(f"ogr2ogr falló: {detail}") from exc
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("ogr2ogr excedió el tiempo máximo de conversión") from exc

        geojson = json.loads(output.decode("utf-8", errors="ignore"))
        features = geojson.get("features") if isinstance(geojson, dict) else None

        if not features:
            raise RuntimeError("Conversión GML→GeoJSON sin features")

        return features[0]
