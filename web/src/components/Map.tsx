"use client";

import React, { useEffect, useRef } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type ParcelFeature = GeoJSON.Feature<GeoJSON.Polygon>;

export default function Map() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);

    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        const styleUrl = "https://demotiles.maplibre.org/style.json";

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: styleUrl,
            center: [-3.7038, 40.4168],
            zoom: 5,
        });

        map.addControl(new maplibregl.NavigationControl(), "top-right");
        mapRef.current = map;

        map.on("load", async () => {
            const res = await fetch("http://localhost:8000/parcels/lookup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cadastral_ref: "1234567AB1234C" }),
            });

            console.log("HTTP status:", res.status);

            const data = await res.json();
            console.log("Respuesta API:", data);

            if (!data?.parcel?.geometry) {
                console.error("No hay geometría válida");
                return;
            }

            const feature: ParcelFeature = data.parcel;
            console.log("Feature usada:", feature);

            if (!data || !data.parcel || !data.parcel.geometry) {
                console.error("Respuesta inesperada del backend:", data);
                return;
            }

            map.addSource("parcel", {
                type: "geojson",
                data: feature,
            });

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

            if (feature.geometry.type === "Polygon") {
                const bounds = new maplibregl.LngLatBounds();
                feature.geometry.coordinates[0].forEach((coord) => {
                    bounds.extend(coord as [number, number]);
                });
                map.fitBounds(bounds, { padding: 40 });
            }
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    return <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />;
}
