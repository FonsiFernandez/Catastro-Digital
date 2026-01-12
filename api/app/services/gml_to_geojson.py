import json
import subprocess
import tempfile
from pathlib import Path


def gml_text_to_geojson_feature(xml_text: str) -> dict:
    """
    Convierte GML/XML (WFS) a GeoJSON usando ogr2ogr y devuelve la primera Feature.
    Reproyecta a EPSG:4326.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        in_path = tmpdir_path / "parcel.gml"

        # Guardar el XML tal cual
        in_path.write_text(xml_text, encoding="latin-1", errors="ignore")

        # ogr2ogr a stdout con reproyección a 4326
        # -t_srs fuerza salida en EPSG:4326
        cmd = [
            "ogr2ogr",
            "-f", "GeoJSON",
            "/vsistdout/",
            str(in_path),
            "-t_srs", "EPSG:4326",
        ]

        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT)
        geojson = json.loads(out.decode("utf-8", errors="ignore"))

        features = geojson.get("features") if isinstance(geojson, dict) else None
        if not features:
            raise RuntimeError("Conversión GML→GeoJSON sin features")

        return features[0]
