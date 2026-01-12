"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type ParcelFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

export default function Map() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);

    const [showCatastro, setShowCatastro] = useState(true);
    const [rc, setRc] = useState("36034A09800089"); // tu ejemplo real

    const apiUrl = useMemo(
        () => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
        []
    );

    const CATASTRO_WMS = "https://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx";
    const baseStyleUrl = "https://demotiles.maplibre.org/style.json";

    // Helpers
    const ensureCatastroLayer = (map: MapLibreMap) => {
        if (map.getSource("catastro-wms")) return;

        map.addSource("catastro-wms", {
            type: "raster",
            tiles: [
                `${CATASTRO_WMS}?service=WMS&request=GetMap&version=1.3.0` +
                `&layers=CP.CadastralParcel` +
                `&styles=CP.CadastralParcel.BoundariesOnly` +
                `&format=image/png&transparent=true` +
                `&crs=EPSG:3857` +
                `&bbox={bbox-epsg-3857}&width=256&height=256`,
            ],
            tileSize: 256,
        });

        map.addLayer({
            id: "catastro-wms-layer",
            type: "raster",
            source: "catastro-wms",
            paint: {
                // Más opaco al hacer zoom-out; menos opaco al acercarte (para que no moleste)
                "raster-opacity": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    5, 0.95,
                    9, 0.90,
                    12, 0.80,
                    15, 0.65,
                    18, 0.55
                ],
            },
        });

        map.on("zoom", () => {
            // No hace nada extra, pero fuerza a que tu lógica de UI (si la amplías) tenga un hook.
        });
    };

    const setCatastroVisibility = (map: MapLibreMap, visible: boolean) => {
        if (!map.getLayer("catastro-wms-layer")) return;
        map.setLayoutProperty("catastro-wms-layer", "visibility", visible ? "visible" : "none");
    };

    const ensureParcelLayers = (map: MapLibreMap) => {
        if (!map.getSource("parcel")) {
            map.addSource("parcel", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] } as any,
            });
        }

        if (!map.getLayer("parcel-fill")) {
            map.addLayer({
                id: "parcel-fill",
                type: "fill",
                source: "parcel",
                paint: {
                    "fill-color": "#ff0000",
                    "fill-opacity": 0.35,
                },
            });
        }

        if (!map.getLayer("parcel-line")) {
            map.addLayer({
                id: "parcel-line",
                type: "line",
                source: "parcel",
                paint: {
                    "line-color": "#aa0000",
                    "line-width": 2,
                },
            });
        }

        // Garantiza que la parcela quede por encima del WMS
        if (map.getLayer("catastro-wms-layer")) {
            map.moveLayer("parcel-fill");
            map.moveLayer("parcel-line");
        }
    };

    const fitToFeature = (map: MapLibreMap, feature: ParcelFeature) => {
        const bounds = new maplibregl.LngLatBounds();

        if (feature.geometry.type === "Polygon") {
            feature.geometry.coordinates[0].forEach((c) => bounds.extend(c as [number, number]));
        } else if (feature.geometry.type === "MultiPolygon") {
            feature.geometry.coordinates.forEach((poly) => {
                poly[0].forEach((c) => bounds.extend(c as [number, number]));
            });
        }

        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60 });
    };

    const loadParcel = async (cadastralRef: string) => {
        const map = mapRef.current;
        if (!map) return;

        const res = await fetch(`${apiUrl}/parcels/lookup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cadastral_ref: cadastralRef }),
        });

        if (!res.ok) {
            const txt = await res.text();
            console.error("API error:", res.status, txt);
            return;
        }

        const data = await res.json();
        const feature: ParcelFeature | undefined = data?.parcel;

        if (!feature?.geometry) {
            console.error("Respuesta inesperada del backend (sin geometry):", data);
            return;
        }

        ensureParcelLayers(map);

        const src = map.getSource("parcel") as maplibregl.GeoJSONSource;
        src.setData(feature as any);

        fitToFeature(map, feature);
    };

    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: baseStyleUrl,
            center: [-3.7038, 40.4168],
            zoom: 5,
        });

        map.addControl(new maplibregl.NavigationControl(), "top-right");
        mapRef.current = map;

        map.on("load", async () => {
            // WMS Catastro
            ensureCatastroLayer(map);
            setCatastroVisibility(map, showCatastro);

            // Parcel layers + primera carga
            ensureParcelLayers(map);
            await loadParcel(rc);
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Toggle WMS sin recrear mapa
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        if (!map.isStyleLoaded()) return;

        if (showCatastro) {
            ensureCatastroLayer(map);
            setCatastroVisibility(map, true);
            // Re-subir parcel layers por si acaso
            if (map.getLayer("parcel-fill")) map.moveLayer("parcel-fill");
            if (map.getLayer("parcel-line")) map.moveLayer("parcel-line");
        } else {
            setCatastroVisibility(map, false);
        }
    }, [showCatastro]);

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
            {/* Panel de control */}
            <div
                style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    zIndex: 10,
                    background: "white",
                    padding: 12,
                    borderRadius: 8,
                    boxShadow: "0 2px 10px rgba(0,0,0,0.15)",
                    width: 360,
                }}
            >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>CadWeb</div>

                <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                    <input
                        type="checkbox"
                        checked={showCatastro}
                        onChange={(e) => setShowCatastro(e.target.checked)}
                    />
                    <span>Mostrar límites de parcelas (Catastro WMS)</span>
                </label>

                <div style={{ display: "flex", gap: 8 }}>
                    <input
                        value={rc}
                        onChange={(e) => setRc(e.target.value)}
                        placeholder="Referencia catastral"
                        style={{
                            flex: 1,
                            padding: "8px 10px",
                            border: "1px solid #ccc",
                            borderRadius: 6,
                            fontSize: 14,
                        }}
                    />
                    <button
                        onClick={() => loadParcel(rc)}
                        style={{
                            padding: "8px 12px",
                            border: "1px solid #999",
                            background: "#f5f5f5",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: 14,
                        }}
                    >
                        Buscar
                    </button>
                </div>

                <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>
                    Consejo: haz zoom (nivel 16+) para ver mejor los límites del Catastro.
                </div>
            </div>

            {/* Mapa */}
            <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
        </div>
    );
}
