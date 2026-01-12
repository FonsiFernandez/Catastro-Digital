"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type ParcelProps = {
    cadastral_ref: string;
    name: string | null;
    color: string | null;
    group_id: string | null;
    is_deleted?: boolean;
};

type ParcelFeature = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, ParcelProps>;
type ParcelFC = GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon, ParcelProps>;

type Group = { id: string; name: string; is_hidden: boolean };

export default function CadMap() {
    const mapContainer = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapLibreMap | null>(null);

    const apiUrl = useMemo(() => process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000", []);

    // UI state
    const [rcInput, setRcInput] = useState("36034A09800089");
    const [showCatastro, setShowCatastro] = useState(false);
    const [includeDeleted, setIncludeDeleted] = useState(false);

    const [groups, setGroups] = useState<Group[]>([]);
    const [parcels, setParcels] = useState<ParcelFeature[]>([]);
    const [selectedRc, setSelectedRc] = useState<string | null>(null);

    const CATASTRO_WMS = "https://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx";
    const baseStyleUrl = "https://demotiles.maplibre.org/style.json";

    // -------- API helpers --------

    const fetchGroups = async () => {
        const res = await fetch(`${apiUrl}/groups`);
        if (!res.ok) {
            console.error("GET /groups failed:", res.status, await res.text());
            return;
        }
        const data = await res.json();
        setGroups(data.groups ?? []);
    };

    const fetchParcels = async (opts?: { include_deleted?: boolean }) => {
        const inc = opts?.include_deleted ?? includeDeleted;
        const url = `${apiUrl}/parcels${inc ? "?include_deleted=true" : ""}`;
        const res = await fetch(url);
        if (!res.ok) {
            console.error("GET /parcels failed:", res.status, await res.text());
            return;
        }
        const fc: ParcelFC = await res.json();
        setParcels((fc.features ?? []) as ParcelFeature[]);
    };

    const lookupParcel = async (rc: string) => {
        const res = await fetch(`${apiUrl}/parcels/lookup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cadastral_ref: rc }),
        });
        if (!res.ok) {
            console.error("POST /parcels/lookup failed:", res.status, await res.text());
            return null;
        }
        const data = await res.json();
        return data?.parcel as ParcelFeature | null;
    };

    const patchParcel = async (rc: string, payload: any) => {
        const res = await fetch(`${apiUrl}/parcels/${encodeURIComponent(rc)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            console.error("PATCH /parcels failed:", res.status, await res.text());
            return false;
        }
        return true;
    };

    const softDeleteParcel = async (rc: string) => {
        const res = await fetch(`${apiUrl}/parcels/${encodeURIComponent(rc)}`, {
            method: "DELETE",
        });
        if (!res.ok) {
            console.error("DELETE /parcels failed:", res.status, await res.text());
            return false;
        }
        return true;
    };

    const createGroup = async (name: string) => {
        const res = await fetch(`${apiUrl}/groups`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        if (!res.ok) {
            console.error("POST /groups failed:", res.status, await res.text());
            return null;
        }
        return (await res.json()) as Group;
    };

    const patchGroup = async (groupId: string, payload: any) => {
        const res = await fetch(`${apiUrl}/groups/${groupId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            console.error("PATCH /groups failed:", res.status, await res.text());
            return false;
        }
        return true;
    };

    // -------- Map helpers --------

    const ensureCatastroLayer = (map: MapLibreMap) => {
        if (map.getSource("catastro-wms")) return;

        // IMPORTANTE: usar proxy (evita CORS)
        map.addSource("catastro-wms", {
            type: "raster",
            tiles: [
                `${apiUrl}/wms/catastro?bbox={bbox-epsg-3857}&width=512&height=512`,
            ],
            tileSize: 512,
        });

        map.addLayer({
            id: "catastro-wms-layer",
            type: "raster",
            source: "catastro-wms",
            paint: { "raster-opacity": 0.7 },
        });
    };

    const setCatastroVisibility = (map: MapLibreMap, visible: boolean) => {
        if (!map.getLayer("catastro-wms-layer")) return;
        map.setLayoutProperty("catastro-wms-layer", "visibility", visible ? "visible" : "none");
    };

    const ensureParcelsLayers = (map: MapLibreMap) => {
        if (!map.getSource("parcels")) {
            map.addSource("parcels", {
                type: "geojson",
                data: { type: "FeatureCollection", features: [] } as any,
            });
        }

        if (!map.getLayer("parcels-fill")) {
            map.addLayer({
                id: "parcels-fill",
                type: "fill",
                source: "parcels",
                paint: {
                    "fill-color": ["coalesce", ["get", "color"], "#ff0000"],
                    "fill-opacity": 0.30,
                },
            });
        }

        if (!map.getLayer("parcels-line")) {
            map.addLayer({
                id: "parcels-line",
                type: "line",
                source: "parcels",
                paint: {
                    "line-color": ["coalesce", ["get", "color"], "#aa0000"],
                    "line-width": 2,
                },
            });
        }

        // Resaltado de la seleccionada
        if (!map.getLayer("parcel-selected-line")) {
            map.addLayer({
                id: "parcel-selected-line",
                type: "line",
                source: "parcels",
                filter: ["==", ["get", "cadastral_ref"], ""],
                paint: {
                    "line-color": "#000000",
                    "line-width": 4,
                },
            });
        }

        // Asegura orden: WMS debajo, parcelas encima
        if (map.getLayer("catastro-wms-layer")) {
            map.moveLayer("parcels-fill");
            map.moveLayer("parcels-line");
            map.moveLayer("parcel-selected-line");
        }
    };

    const setParcelsData = (map: MapLibreMap, features: ParcelFeature[]) => {
        const src = map.getSource("parcels") as maplibregl.GeoJSONSource;
        src.setData({ type: "FeatureCollection", features } as any);
    };

    const fitToFeature = (map: MapLibreMap, feature: ParcelFeature) => {
        const bounds = new maplibregl.LngLatBounds();
        const geom = feature.geometry;

        if (geom.type === "Polygon") {
            geom.coordinates[0].forEach((c) => bounds.extend(c as [number, number]));
        } else if (geom.type === "MultiPolygon") {
            geom.coordinates.forEach((poly) => poly[0].forEach((c) => bounds.extend(c as [number, number])));
        }

        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60 });
    };

    const visibleParcels = useMemo(() => {
        const hiddenGroupIds = new Set(groups.filter((g) => g.is_hidden).map((g) => g.id));
        return parcels.filter((f) => {
            const p = f.properties;
            if (!p) return false;
            if (!includeDeleted && p.is_deleted) return false;
            if (p.group_id && hiddenGroupIds.has(p.group_id)) return false;
            return true;
        });
    }, [parcels, groups, includeDeleted]);

    // -------- Initialization --------

    useEffect(() => {
        // cargar datos (API)
        (async () => {
            await fetchGroups();
            await fetchParcels({ include_deleted: includeDeleted });
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

        map.on("load", () => {
            // Catastro SOLO si está activo
            if (showCatastro) {
                ensureCatastroLayer(map);
                setCatastroVisibility(map, true);
            }

            ensureParcelsLayers(map);
            setParcelsData(map, visibleParcels);

            map.on("click", "parcels-fill", (e) => {
                const feats = e.features as any[] | undefined;
                if (!feats || feats.length === 0) return;
                const rc = feats[0]?.properties?.cadastral_ref as string | undefined;
                if (!rc) return;
                setSelectedRc(rc);
            });
        });

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // actualizar mapa cuando cambien visibilidad/grupos/borradas
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;
        ensureParcelsLayers(map);
        setParcelsData(map, visibleParcels);
    }, [visibleParcels]);

    // catastro toggle
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;

        if (showCatastro) {
            ensureCatastroLayer(map);
            setCatastroVisibility(map, true);

            // asegura orden: catastro debajo, parcelas encima
            if (map.getLayer("parcels-fill")) map.moveLayer("parcels-fill");
            if (map.getLayer("parcels-line")) map.moveLayer("parcels-line");
            if (map.getLayer("parcel-selected-line")) map.moveLayer("parcel-selected-line");
        } else {
            setCatastroVisibility(map, false);
        }
    }, [showCatastro]);

    // seleccion -> filtro y fit
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return;
        if (!map.getLayer("parcel-selected-line")) return;

        map.setFilter("parcel-selected-line", [
            "==",
            ["get", "cadastral_ref"],
            selectedRc ?? "",
        ]);

        if (selectedRc) {
            const f = parcels.find((x) => x.properties?.cadastral_ref === selectedRc);
            if (f) fitToFeature(map, f);
        }
    }, [selectedRc, parcels]);

    // includeDeleted toggle => recargar del backend (para mostrar borradas reales)
    useEffect(() => {
        (async () => {
            await fetchParcels({ include_deleted: includeDeleted });
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [includeDeleted]);

    // -------- UI actions --------

    const onSearchRc = async () => {
        const rc = rcInput.trim().toUpperCase();
        if (!rc) return;

        const parcel = await lookupParcel(rc);
        if (!parcel) return;

        // refrescar lista completa
        await fetchParcels({ include_deleted: includeDeleted });

        setSelectedRc(rc);

        // si se acaba de crear, puede no estar en visibleParcels por grupo/hidden;
        // hacemos fit sobre el feature retornado directamente
        const map = mapRef.current;
        if (map && map.isStyleLoaded() && parcel?.geometry) {
            fitToFeature(map, parcel);
        }
    };

    const onChangeParcelColor = async (rc: string, color: string) => {
        const ok = await patchParcel(rc, { color });
        if (!ok) return;
        await fetchParcels({ include_deleted: includeDeleted });
    };

    const onRenameParcel = async (rc: string, name: string) => {
        const ok = await patchParcel(rc, { name });
        if (!ok) return;
        await fetchParcels({ include_deleted: includeDeleted });
    };

    const onAssignGroup = async (rc: string, groupIdOrEmpty: string) => {
        // group_id: "" => quitar
        const ok = await patchParcel(rc, { group_id: groupIdOrEmpty });
        if (!ok) return;
        await fetchParcels({ include_deleted: includeDeleted });
    };

    const onSoftDelete = async (rc: string) => {
        const ok = await softDeleteParcel(rc);
        if (!ok) return;
        await fetchParcels({ include_deleted: includeDeleted });
        if (selectedRc === rc) setSelectedRc(null);
    };

    const onRestore = async (rc: string) => {
        const ok = await patchParcel(rc, { is_deleted: false });
        if (!ok) return;
        await fetchParcels({ include_deleted: includeDeleted });
    };

    const onToggleGroupHidden = async (g: Group) => {
        const ok = await patchGroup(g.id, { is_hidden: !g.is_hidden });
        if (!ok) return;
        await fetchGroups();
    };

    const onCreateGroup = async () => {
        const name = prompt("Nombre del grupo:");
        if (!name) return;
        const created = await createGroup(name);
        if (!created) return;
        await fetchGroups();
    };

    // Derivados para UI
    const parcelsByGroup = useMemo(() => {
        const map = new Map<string, ParcelFeature[]>();
        for (const p of parcels) {
            const gid = p.properties?.group_id ?? "__none__";
            if (!map.has(gid)) map.set(gid, []);
            map.get(gid)!.push(p);
        }
        // ordenar por nombre luego por rc
        for (const [k, arr] of map.entries()) {
            arr.sort((a, b) => {
                const an = (a.properties?.name ?? "").toLowerCase();
                const bn = (b.properties?.name ?? "").toLowerCase();
                if (an !== bn) return an.localeCompare(bn);
                return (a.properties?.cadastral_ref ?? "").localeCompare(b.properties?.cadastral_ref ?? "");
            });
            map.set(k, arr);
        }
        return map;
    }, [parcels]);

    const groupName = (gid: string) => {
        if (gid === "__none__") return "Sin grupo";
        return groups.find((g) => g.id === gid)?.name ?? "Grupo";
    };

    const groupHidden = (gid: string) => {
        if (gid === "__none__") return false;
        return groups.find((g) => g.id === gid)?.is_hidden ?? false;
    };

    // -------- Render --------

    return (
        <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
            {/* Panel lateral */}
            <div
                style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    bottom: 12,
                    width: 420,
                    zIndex: 10,
                    background: "white",
                    padding: 12,
                    borderRadius: 10,
                    boxShadow: "0 2px 12px rgba(0,0,0,0.18)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                    <div style={{ fontWeight: 700 }}>CadWeb</div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                            <input type="checkbox" checked={showCatastro} onChange={(e) => setShowCatastro(e.target.checked)} />
                            Catastro
                        </label>
                        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                            <input type="checkbox" checked={includeDeleted} onChange={(e) => setIncludeDeleted(e.target.checked)} />
                            Mostrar borradas
                        </label>
                    </div>
                </div>

                {/* Buscar RC */}
                <div style={{ display: "flex", gap: 8 }}>
                    <input
                        value={rcInput}
                        onChange={(e) => setRcInput(e.target.value)}
                        placeholder="Referencia catastral (RC)"
                        style={{
                            flex: 1,
                            padding: "8px 10px",
                            border: "1px solid #ccc",
                            borderRadius: 8,
                            fontSize: 14,
                        }}
                    />
                    <button
                        onClick={onSearchRc}
                        style={{
                            padding: "8px 12px",
                            border: "1px solid #999",
                            background: "#f5f5f5",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontSize: 14,
                            whiteSpace: "nowrap",
                        }}
                    >
                        Buscar / Añadir
                    </button>
                </div>

                {/* Grupos */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 600 }}>Grupos</div>
                    <button
                        onClick={onCreateGroup}
                        style={{
                            padding: "6px 10px",
                            border: "1px solid #999",
                            background: "#f5f5f5",
                            borderRadius: 8,
                            cursor: "pointer",
                            fontSize: 13,
                        }}
                    >
                        + Grupo
                    </button>
                </div>

                {/* Lista scroll */}
                <div style={{ flex: 1, overflow: "auto", borderTop: "1px solid #eee", paddingTop: 8 }}>
                    {/* Render por grupo: primero sin grupo, luego los demás */}
                    {["__none__", ...groups.map((g) => g.id)].map((gid) => {
                        const list = parcelsByGroup.get(gid) ?? [];
                        if (list.length === 0) return null;

                        const hidden = groupHidden(gid);

                        return (
                            <div key={gid} style={{ marginBottom: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                                    <div style={{ fontWeight: 600 }}>
                                        {groupName(gid)}{" "}
                                        <span style={{ fontWeight: 400, color: "#666" }}>({list.length})</span>
                                    </div>

                                    {gid !== "__none__" ? (
                                        <button
                                            onClick={() => {
                                                const g = groups.find((x) => x.id === gid);
                                                if (g) onToggleGroupHidden(g);
                                            }}
                                            style={{
                                                padding: "4px 8px",
                                                border: "1px solid #bbb",
                                                background: hidden ? "#ffe9e9" : "#f5f5f5",
                                                borderRadius: 8,
                                                cursor: "pointer",
                                                fontSize: 12,
                                            }}
                                            title={hidden ? "Mostrar grupo" : "Ocultar grupo"}
                                        >
                                            {hidden ? "Mostrar" : "Ocultar"}
                                        </button>
                                    ) : (
                                        <span style={{ fontSize: 12, color: "#888" }} />
                                    )}
                                </div>

                                {/* Parcels list */}
                                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 8 }}>
                                    {list.map((f) => {
                                        const p = f.properties!;
                                        const rc = p.cadastral_ref;
                                        const selected = selectedRc === rc;

                                        return (
                                            <div
                                                key={rc}
                                                style={{
                                                    border: selected ? "2px solid #000" : "1px solid #ddd",
                                                    borderRadius: 10,
                                                    padding: 10,
                                                    background: p.is_deleted ? "#fafafa" : "white",
                                                    opacity: p.is_deleted ? 0.6 : 1,
                                                }}
                                            >
                                                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                                            {p.name?.trim() ? p.name : "Sin nombre"}
                                                        </div>
                                                        <div style={{ fontSize: 12, color: "#666" }}>{rc}</div>
                                                    </div>

                                                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                                                        <button
                                                            onClick={() => setSelectedRc(rc)}
                                                            style={{
                                                                padding: "4px 8px",
                                                                border: "1px solid #bbb",
                                                                background: "#f5f5f5",
                                                                borderRadius: 8,
                                                                cursor: "pointer",
                                                                fontSize: 12,
                                                            }}
                                                        >
                                                            Ver
                                                        </button>

                                                        {!p.is_deleted ? (
                                                            <button
                                                                onClick={() => onSoftDelete(rc)}
                                                                style={{
                                                                    padding: "4px 8px",
                                                                    border: "1px solid #bbb",
                                                                    background: "#fff0f0",
                                                                    borderRadius: 8,
                                                                    cursor: "pointer",
                                                                    fontSize: 12,
                                                                }}
                                                                title="Soft-delete (no borra de la DB)"
                                                            >
                                                                Borrar
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => onRestore(rc)}
                                                                style={{
                                                                    padding: "4px 8px",
                                                                    border: "1px solid #bbb",
                                                                    background: "#f0fff0",
                                                                    borderRadius: 8,
                                                                    cursor: "pointer",
                                                                    fontSize: 12,
                                                                }}
                                                            >
                                                                Restaurar
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
                                                    {/* Color */}
                                                    <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                                                        Color
                                                        <input
                                                            type="color"
                                                            value={(p.color ?? "#ff0000").toLowerCase()}
                                                            onChange={(e) => onChangeParcelColor(rc, e.target.value)}
                                                            disabled={!!p.is_deleted}
                                                            style={{ width: 34, height: 26, padding: 0, border: "none", background: "transparent" }}
                                                        />
                                                    </label>

                                                    {/* Nombre */}
                                                    <input
                                                        defaultValue={p.name ?? ""}
                                                        placeholder="Nombre"
                                                        disabled={!!p.is_deleted}
                                                        onBlur={(e) => onRenameParcel(rc, e.target.value)}
                                                        style={{
                                                            flex: 1,
                                                            padding: "6px 8px",
                                                            border: "1px solid #ccc",
                                                            borderRadius: 8,
                                                            fontSize: 13,
                                                        }}
                                                    />

                                                    {/* Grupo */}
                                                    <select
                                                        value={p.group_id ?? ""}
                                                        disabled={!!p.is_deleted}
                                                        onChange={(e) => onAssignGroup(rc, e.target.value)}
                                                        style={{
                                                            width: 150,
                                                            padding: "6px 8px",
                                                            border: "1px solid #ccc",
                                                            borderRadius: 8,
                                                            fontSize: 13,
                                                            background: "white",
                                                        }}
                                                    >
                                                        <option value="">Sin grupo</option>
                                                        {groups.map((g) => (
                                                            <option key={g.id} value={g.id}>
                                                                {g.name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Pie */}
                <div style={{ fontSize: 12, color: "#666", borderTop: "1px solid #eee", paddingTop: 8 }}>
                    En el mapa se muestran solo parcelas no borradas y grupos visibles (salvo que actives “Mostrar borradas”).
                </div>
            </div>

            {/* Mapa */}
            <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
        </div>
    );
}
