"use client";

import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function Map() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);

    useEffect(() => {
        if (!mapContainer.current || mapRef.current) return;

        // Estilo público compatible con MapLibre (base OSM)
        const styleUrl = "https://demotiles.maplibre.org/style.json";

        const map = new maplibregl.Map({
            container: mapContainer.current,
            style: styleUrl,
            center: [-3.7038, 40.4168], // Madrid
            zoom: 5
        });

        map.addControl(new maplibregl.NavigationControl(), "top-right");
        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
    }, []);

    return <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />;
}
