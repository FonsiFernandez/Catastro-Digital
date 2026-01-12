"use client";

import React, { useEffect, useRef } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type ParcelFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

export default function Map() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);

    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        const styleUrl = "https://demotiles.maplibre.org/style.json";
        const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        const CATASTRO_WMS =
            "https://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx";

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: styleUrl,
            center: [-3.7038, 40.4168],
            zoom: 5,
        });

        map.addControl(new maplibregl.NavigationControl(), "top-right");
        mapRef.current = map;

        map.on("load", async () => {
            // 1) (Opcional) WMS Catastro - desactivado hasta tener URL real
            const ENABLE_CATASTRO = false;
            if (ENABLE_CATASTRO) {
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
                    paint: { "raster-opacity": 0.6 },
                });
            }

            // 2) Llamada al backend (mock/db)
            const res = await fetch(`${apiUrl}/parcels/lookup`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cadastral_ref: "1234567AB1234C" }),
            });

            console.log("HTTP status:", res.status);

            if (!res.ok) {
                console.error("API error:", await res.text());
                return;
            }

            const data = await res.json();
            console.log("Respuesta API:", data);

            const feature: ParcelFeature | undefined = data?.parcel;
            if (!feature?.geometry) {
                console.error("No hay geometría válida", data);
                return;
            }

            // 3) Source GeoJSON (si existe, actualiza; si no, crea)
            if (map.getSource("parcel")) {
                (map.getSource("parcel") as maplibregl.GeoJSONSource).setData(feature as any);
            } else {
                map.addSource("parcel", { type: "geojson", data: feature as any });

                map.addLayer({
                    id: "parcel-fill",
                    type: "fill",
                    source: "parcel",
                    paint: {
                        "fill-color": "#ff0000",
                        "fill-opacity": 0.4,
                    },
                });

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

            // 4) Fit bounds (Polygon o MultiPolygon)
            const bounds = new maplibregl.LngLatBounds();

            if (feature.geometry.type === "Polygon") {
                feature.geometry.coordinates[0].forEach((c) => bounds.extend(c as [number, number]));
            } else if (feature.geometry.type === "MultiPolygon") {
                feature.geometry.coordinates.forEach((poly) => {
                    poly[0].forEach((c) => bounds.extend(c as [number, number]));
                });
            }

            if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40 });
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    return <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />;
}
