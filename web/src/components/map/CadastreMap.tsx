"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import type { FeatureCollection } from "geojson";
import {
  AttributionControl,
  Map as MapLibreMapClass,
  Marker,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
  type Map as MapLibreMap,
  type MapMouseEvent,
} from "maplibre-gl";
import {
  accuracyCircleFeature,
  asFeatureCollection,
  BASE_MAP_STYLE,
  boundaryGuideFeature,
  CATASTRO_LAYER_ID,
  CATASTRO_SOURCE_ID,
  DEFAULT_PARCEL_COLOR,
  FIELD_ACCURACY_FILL_LAYER_ID,
  FIELD_ACCURACY_LINE_LAYER_ID,
  FIELD_ACCURACY_SOURCE_ID,
  FIELD_BOUNDARY_LINE_LAYER_ID,
  FIELD_BOUNDARY_POINT_LAYER_ID,
  FIELD_BOUNDARY_SOURCE_ID,
  FIELD_LOCATION_LAYER_ID,
  FIELD_LOCATION_SOURCE_ID,
  FIELD_TARGET_LAYER_ID,
  fitToFeature,
  fitToFeatures,
  locationPointFeature,
  PARCEL_FILL_LAYER_ID,
  PARCEL_LINE_LAYER_ID,
  PARCEL_PREVIEW_FILL_LAYER_ID,
  PARCEL_PREVIEW_LINE_LAYER_ID,
  PARCEL_PREVIEW_SOURCE_ID,
  PARCEL_SELECTED_LAYER_ID,
  PARCEL_SOURCE_ID,
  setBaseMapVisibility,
} from "@/lib/map";
import type {
  BaseMapId,
  DeviceLocation,
  FieldTarget,
  ParcelFeature,
} from "@/types/cadastre";

export type CadastreMapHandle = {
  fitParcel: (parcel: ParcelFeature) => void;
  fitAll: () => void;
  centerLocation: (location: DeviceLocation) => void;
  clearFieldMode: () => void;
  resizeFor: (durationMs?: number) => void;
};

type CadastreMapProps = {
  parcels: ParcelFeature[];
  selectedRc: string | null;
  showCatastro: boolean;
  baseMap: BaseMapId;
  previewParcel: ParcelFeature | null;
  fieldMode: boolean;
  detailMode: boolean;
  fieldLocation: DeviceLocation | null;
  fieldTarget: FieldTarget | null;
  onSelectParcel: (cadastralRef: string | null) => void;
  onIdentifyPoint: (longitude: number, latitude: number) => void;
  onCatastroUnavailable?: () => void;
};

const EMPTY_COLLECTION: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function addApplicationLayers(map: MapLibreMap): void {
  if (!map.getSource(CATASTRO_SOURCE_ID)) {
    map.addSource(CATASTRO_SOURCE_ID, {
      type: "raster",
      tiles: ["/api/wms/catastro?bbox={bbox-epsg-3857}&width=512&height=512"],
      tileSize: 512,
    });
  }

  if (!map.getLayer(CATASTRO_LAYER_ID)) {
    map.addLayer({
      id: CATASTRO_LAYER_ID,
      type: "raster",
      source: CATASTRO_SOURCE_ID,
      layout: { visibility: "none" },
      paint: { "raster-opacity": 0.72 },
    });
  }

  if (!map.getSource(PARCEL_SOURCE_ID)) {
    map.addSource(PARCEL_SOURCE_ID, {
      type: "geojson",
      data: asFeatureCollection([]),
    });
  }

  if (!map.getLayer(PARCEL_FILL_LAYER_ID)) {
    map.addLayer({
      id: PARCEL_FILL_LAYER_ID,
      type: "fill",
      source: PARCEL_SOURCE_ID,
      paint: {
        "fill-color": ["coalesce", ["get", "color"], DEFAULT_PARCEL_COLOR],
        "fill-opacity": [
          "case",
          ["boolean", ["get", "is_deleted"], false],
          0.1,
          0.28,
        ],
      },
    });
  }

  if (!map.getLayer(PARCEL_LINE_LAYER_ID)) {
    map.addLayer({
      id: PARCEL_LINE_LAYER_ID,
      type: "line",
      source: PARCEL_SOURCE_ID,
      paint: {
        "line-color": ["coalesce", ["get", "color"], DEFAULT_PARCEL_COLOR],
        "line-width": 2.4,
        "line-opacity": [
          "case",
          ["boolean", ["get", "is_deleted"], false],
          0.4,
          1,
        ],
      },
    });
  }

  if (!map.getLayer(PARCEL_SELECTED_LAYER_ID)) {
    map.addLayer({
      id: PARCEL_SELECTED_LAYER_ID,
      type: "line",
      source: PARCEL_SOURCE_ID,
      filter: ["==", ["get", "cadastral_ref"], ""],
      paint: {
        "line-color": "#111827",
        "line-width": 4.5,
        "line-opacity": 0.92,
      },
    });
  }

  if (!map.getLayer(FIELD_TARGET_LAYER_ID)) {
    map.addLayer({
      id: FIELD_TARGET_LAYER_ID,
      type: "line",
      source: PARCEL_SOURCE_ID,
      filter: ["==", ["get", "cadastral_ref"], ""],
      paint: {
        "line-color": "#0f766e",
        "line-width": 5.5,
        "line-opacity": 0.95,
      },
    });
  }

  if (!map.getSource(PARCEL_PREVIEW_SOURCE_ID)) {
    map.addSource(PARCEL_PREVIEW_SOURCE_ID, {
      type: "geojson",
      data: asFeatureCollection([]),
    });
  }

  if (!map.getLayer(PARCEL_PREVIEW_FILL_LAYER_ID)) {
    map.addLayer({
      id: PARCEL_PREVIEW_FILL_LAYER_ID,
      type: "fill",
      source: PARCEL_PREVIEW_SOURCE_ID,
      paint: {
        "fill-color": "#f59e0b",
        "fill-opacity": 0.24,
      },
    });
  }

  if (!map.getLayer(PARCEL_PREVIEW_LINE_LAYER_ID)) {
    map.addLayer({
      id: PARCEL_PREVIEW_LINE_LAYER_ID,
      type: "line",
      source: PARCEL_PREVIEW_SOURCE_ID,
      paint: {
        "line-color": "#d97706",
        "line-width": 3.5,
        "line-dasharray": [2, 1.3],
      },
    });
  }

  if (!map.getSource(FIELD_ACCURACY_SOURCE_ID)) {
    map.addSource(FIELD_ACCURACY_SOURCE_ID, { type: "geojson", data: EMPTY_COLLECTION });
  }
  if (!map.getLayer(FIELD_ACCURACY_FILL_LAYER_ID)) {
    map.addLayer({
      id: FIELD_ACCURACY_FILL_LAYER_ID,
      type: "fill",
      source: FIELD_ACCURACY_SOURCE_ID,
      paint: { "fill-color": "#2563eb", "fill-opacity": 0.1 },
    });
  }
  if (!map.getLayer(FIELD_ACCURACY_LINE_LAYER_ID)) {
    map.addLayer({
      id: FIELD_ACCURACY_LINE_LAYER_ID,
      type: "line",
      source: FIELD_ACCURACY_SOURCE_ID,
      paint: { "line-color": "#2563eb", "line-opacity": 0.5, "line-width": 1.5 },
    });
  }

  if (!map.getSource(FIELD_BOUNDARY_SOURCE_ID)) {
    map.addSource(FIELD_BOUNDARY_SOURCE_ID, { type: "geojson", data: EMPTY_COLLECTION });
  }
  if (!map.getLayer(FIELD_BOUNDARY_LINE_LAYER_ID)) {
    map.addLayer({
      id: FIELD_BOUNDARY_LINE_LAYER_ID,
      type: "line",
      source: FIELD_BOUNDARY_SOURCE_ID,
      paint: {
        "line-color": "#f59e0b",
        "line-width": 2.5,
        "line-dasharray": [2, 1.5],
      },
    });
  }
  if (!map.getLayer(FIELD_BOUNDARY_POINT_LAYER_ID)) {
    map.addLayer({
      id: FIELD_BOUNDARY_POINT_LAYER_ID,
      type: "circle",
      source: FIELD_BOUNDARY_SOURCE_ID,
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-radius": 5,
        "circle-color": "#f59e0b",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
  }

  if (!map.getSource(FIELD_LOCATION_SOURCE_ID)) {
    map.addSource(FIELD_LOCATION_SOURCE_ID, { type: "geojson", data: EMPTY_COLLECTION });
  }
  if (!map.getLayer(FIELD_LOCATION_LAYER_ID)) {
    map.addLayer({
      id: FIELD_LOCATION_LAYER_ID,
      type: "circle",
      source: FIELD_LOCATION_SOURCE_ID,
      paint: {
        "circle-radius": 5,
        "circle-color": "#365f4b",
        "circle-opacity": 0.18,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-opacity": 0,
        "circle-stroke-width": 0,
      },
    });
  }
}

function updateFieldLayers(
    map: MapLibreMap,
    location: DeviceLocation | null,
    target: FieldTarget | null,
): void {
  const accuracySource = map.getSource(FIELD_ACCURACY_SOURCE_ID) as GeoJSONSource | undefined;
  const locationSource = map.getSource(FIELD_LOCATION_SOURCE_ID) as GeoJSONSource | undefined;
  const boundarySource = map.getSource(FIELD_BOUNDARY_SOURCE_ID) as GeoJSONSource | undefined;

  accuracySource?.setData(location ? accuracyCircleFeature(location) : EMPTY_COLLECTION);
  locationSource?.setData(location ? locationPointFeature(location) : EMPTY_COLLECTION);

  if (location && target) {
    boundarySource?.setData({
      type: "FeatureCollection",
      features: [
        boundaryGuideFeature(location, target),
        {
          type: "Feature",
          properties: {},
          geometry: target.nearest_boundary,
        },
      ],
    });
  } else {
    boundarySource?.setData(EMPTY_COLLECTION);
  }

  if (map.getLayer(FIELD_TARGET_LAYER_ID)) {
    map.setFilter(FIELD_TARGET_LAYER_ID, [
      "==",
      ["get", "cadastral_ref"],
      target?.parcel.properties.cadastral_ref ?? "",
    ]);
  }
}

function clearFieldLayers(map: MapLibreMap): void {
  const accuracySource = map.getSource(
      FIELD_ACCURACY_SOURCE_ID,
  ) as GeoJSONSource | undefined;

  const locationSource = map.getSource(
      FIELD_LOCATION_SOURCE_ID,
  ) as GeoJSONSource | undefined;

  const boundarySource = map.getSource(
      FIELD_BOUNDARY_SOURCE_ID,
  ) as GeoJSONSource | undefined;

  accuracySource?.setData(EMPTY_COLLECTION);
  locationSource?.setData(EMPTY_COLLECTION);
  boundarySource?.setData(EMPTY_COLLECTION);

  if (map.getLayer(FIELD_TARGET_LAYER_ID)) {
    map.setFilter(FIELD_TARGET_LAYER_ID, [
      "==",
      ["get", "cadastral_ref"],
      "",
    ]);
  }
}

export const CadastreMap = forwardRef<CadastreMapHandle, CadastreMapProps>(
    function CadastreMap(
        {
          parcels,
          selectedRc,
          showCatastro,
          baseMap,
          previewParcel,
          fieldMode,
          detailMode,
          fieldLocation,
          fieldTarget,
          onSelectParcel,
          onIdentifyPoint,
          onCatastroUnavailable,
        },
        ref,
    ) {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const mapRef = useRef<MapLibreMap | null>(null);
      const userMarkerRef = useRef<Marker | null>(null);
      const mapReadyRef = useRef(false);
      const pendingFitRef = useRef<ParcelFeature | null>(null);
      const pendingFitAllRef = useRef(false);
      const parcelsRef = useRef(parcels);
      const selectedRcRef = useRef(selectedRc);
      const showCatastroRef = useRef(showCatastro);
      const baseMapRef = useRef(baseMap);
      const previewParcelRef = useRef(previewParcel);
      const fieldModeRef = useRef(fieldMode);
      const detailModeRef = useRef(detailMode);
      const fieldLocationRef = useRef(fieldLocation);
      const fieldTargetRef = useRef(fieldTarget);
      const onSelectRef = useRef(onSelectParcel);
      const onIdentifyRef = useRef(onIdentifyPoint);
      const catastroErrorCountRef = useRef(0);
      const catastroUnavailableRef = useRef(false);
      const onCatastroUnavailableRef =
          useRef(onCatastroUnavailable);

      parcelsRef.current = parcels;
      selectedRcRef.current = selectedRc;
      showCatastroRef.current = showCatastro;
      baseMapRef.current = baseMap;
      previewParcelRef.current = previewParcel;
      fieldModeRef.current = fieldMode;
      detailModeRef.current = detailMode;
      fieldLocationRef.current = fieldLocation;
      fieldTargetRef.current = fieldTarget;
      onSelectRef.current = onSelectParcel;
      onIdentifyRef.current = onIdentifyPoint;
      onCatastroUnavailableRef.current = onCatastroUnavailable;

      useImperativeHandle(ref, () => ({
        fitParcel(parcel) {
          const map = mapRef.current;
          if (map && mapReadyRef.current) {
            fitToFeature(map, parcel);
            return;
          }
          pendingFitRef.current = parcel;
        },
        fitAll() {
          const map = mapRef.current;
          if (map && mapReadyRef.current) {
            fitToFeatures(map, parcelsRef.current);
            return;
          }
          pendingFitAllRef.current = true;
        },
        centerLocation(location) {
          const map = mapRef.current;
          if (!map || !mapReadyRef.current) return;
          map.easeTo({
            center: [location.longitude, location.latitude],
            zoom: Math.max(map.getZoom(), 18),
            duration: 600,
          });
        },
        clearFieldMode() {
          const map = mapRef.current;
          if (!map || !mapReadyRef.current) return;
          clearFieldLayers(map);
        },
        resizeFor(durationMs = 460) {
          const map = mapRef.current;
          if (!map || !mapReadyRef.current) return;

          const startedAt = performance.now();

          const resizeFrame = (now: number) => {
            map.resize();

            if (now - startedAt < durationMs) {
              window.requestAnimationFrame(resizeFrame);
            }
          };

          map.resize();
          window.requestAnimationFrame(resizeFrame);
        },
      }), []);

      useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

        const map = new MapLibreMapClass({
          container: containerRef.current,
          style: BASE_MAP_STYLE,
          center: [-3.7038, 40.4168],
          zoom: 5.2,
          minZoom: 3,
          maxZoom: 20,
          attributionControl: false,
        });

        map.addControl(new NavigationControl({ showCompass: true }), "top-right");
        map.addControl(new ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");
        map.addControl(new AttributionControl({ compact: true }), "bottom-right");

        map.on("load", () => {
          addApplicationLayers(map);
          mapReadyRef.current = true;
          setBaseMapVisibility(map, baseMapRef.current);

          const source = map.getSource(PARCEL_SOURCE_ID) as GeoJSONSource | undefined;
          source?.setData(asFeatureCollection(parcelsRef.current));

          const previewSource = map.getSource(PARCEL_PREVIEW_SOURCE_ID) as GeoJSONSource | undefined;
          previewSource?.setData(
              asFeatureCollection(previewParcelRef.current ? [previewParcelRef.current] : []),
          );

          map.setLayoutProperty(
              CATASTRO_LAYER_ID,
              "visibility",
              showCatastroRef.current ? "visible" : "none",
          );
          map.setFilter(PARCEL_SELECTED_LAYER_ID, [
            "==",
            ["get", "cadastral_ref"],
            selectedRcRef.current ?? "",
          ]);
          updateFieldLayers(map, fieldLocationRef.current, fieldTargetRef.current);

          map.getCanvas().style.cursor = fieldModeRef.current ? "" : "crosshair";

          if (pendingFitRef.current) {
            fitToFeature(map, pendingFitRef.current);
            pendingFitRef.current = null;
          } else if (pendingFitAllRef.current) {
            fitToFeatures(map, parcelsRef.current);
          }
          pendingFitAllRef.current = false;
        });

        map.on("error", (event) => {
          const mapEvent = event as {
            error?: unknown;
            sourceId?: string;
          };

          const error = mapEvent.error;

          const message =
              error instanceof Error
                  ? error.message
                  : typeof error === "string"
                      ? error
                      : "";

          const isCatastroError =
              mapEvent.sourceId ===
              CATASTRO_SOURCE_ID ||
              message.includes(
                  "/api/wms/catastro",
              );

          if (isCatastroError) {
            /*
             * Do not spam the console with one
             * error for every failed WMS tile.
             */
            catastroErrorCountRef.current += 1;

            if (
                catastroErrorCountRef.current >= 2 &&
                !catastroUnavailableRef.current
            ) {
              catastroUnavailableRef.current =
                  true;

              if (
                  map.getLayer(
                      CATASTRO_LAYER_ID,
                  )
              ) {
                map.setLayoutProperty(
                    CATASTRO_LAYER_ID,
                    "visibility",
                    "none",
                );
              }

              onCatastroUnavailableRef.current?.();
            }

            return;
          }

          /*
           * Other MapLibre errors are still useful
           * and should remain visible.
           */
          console.error(
              "MapLibre error:",
              error ?? event,
          );
        });

        /*
         * A normal click/tap selects a parcel.
         *
         * MapLibre already distinguishes a click/tap from a drag gesture,
         * so moving the map does not trigger parcel identification.
         *
         * Saved parcels are handled first. This prevents a click on an
         * already saved parcel from also launching a Catastro lookup.
         */
        map.on("click", (event: MapMouseEvent) => {
          if (detailModeRef.current) {
            return;
          }

          const savedFeatures = map.queryRenderedFeatures(
              event.point,
              {
                layers: [PARCEL_FILL_LAYER_ID],
              },
          );

          const savedCadastralRef =
              savedFeatures[0]?.properties
                  ?.cadastral_ref as
                  | string
                  | undefined;

          if (savedCadastralRef) {
            if (fieldModeRef.current) {
              /*
               * Field Mode acts like a target selector:
               * - tap another saved parcel -> follow that parcel
               * - tap the selected parcel again -> clear the lock and
               *   return to automatic nearby-parcel detection
               */
              onSelectRef.current(
                  selectedRcRef.current === savedCadastralRef
                      ? null
                      : savedCadastralRef,
              );
            } else {
              onSelectRef.current(
                  savedCadastralRef,
              );
            }

            return;
          }

          /*
           * If the user clicks the parcel currently being previewed,
           * keep the existing preview instead of identifying it again.
           */
          const previewFeatures =
              map.queryRenderedFeatures(
                  event.point,
                  {
                    layers: [
                      PARCEL_PREVIEW_FILL_LAYER_ID,
                    ],
                  },
              );

          if (previewFeatures.length > 0) {
            return;
          }

          if (fieldModeRef.current) {
            return;
          }

          onIdentifyRef.current(
              event.lngLat.lng,
              event.lngLat.lat,
          );
        });

        map.on(
            "mouseenter",
            PARCEL_FILL_LAYER_ID,
            () => {
              map.getCanvas().style.cursor =
                  "pointer";
            },
        );

        map.on(
            "mouseleave",
            PARCEL_FILL_LAYER_ID,
            () => {
              map.getCanvas().style.cursor =
                  fieldModeRef.current
                      ? ""
                      : "crosshair";
            },
        );

        const observer = new ResizeObserver(() => map.resize());
        observer.observe(containerRef.current);

        mapRef.current = map;
        return () => {
          observer.disconnect();
          mapReadyRef.current = false;
          pendingFitRef.current = null;
          pendingFitAllRef.current = false;
          userMarkerRef.current?.remove();
          userMarkerRef.current = null;
          map.remove();
          mapRef.current = null;
        };
      }, []);

      useEffect(() => {
        const map = mapRef.current;
        if (!map?.isStyleLoaded()) return;
        const source = map.getSource(PARCEL_SOURCE_ID) as GeoJSONSource | undefined;
        source?.setData(asFeatureCollection(parcels));
      }, [parcels]);

      useEffect(() => {
        const map = mapRef.current;
        if (!map?.isStyleLoaded()) return;
        const source = map.getSource(PARCEL_PREVIEW_SOURCE_ID) as GeoJSONSource | undefined;
        source?.setData(asFeatureCollection(previewParcel ? [previewParcel] : []));
        if (previewParcel) fitToFeature(map, previewParcel);
      }, [previewParcel]);

      useEffect(() => {
        const map = mapRef.current;
        if (!map?.isStyleLoaded()) return;
        setBaseMapVisibility(map, baseMap);
      }, [baseMap]);

      useEffect(() => {
        const map = mapRef.current;

        if (
            !map?.isStyleLoaded() ||
            !map.getLayer(CATASTRO_LAYER_ID)
        ) {
          return;
        }

        if (showCatastro) {
          /*
           * A manual reactivation means:
           * try the external service again.
           */
          catastroErrorCountRef.current = 0;
          catastroUnavailableRef.current =
              false;
        }

        map.setLayoutProperty(
            CATASTRO_LAYER_ID,
            "visibility",
            showCatastro
                ? "visible"
                : "none",
        );
      }, [showCatastro]);

      useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        map.getCanvas().style.cursor =
            fieldMode || detailMode ? "" : "crosshair";
      }, [detailMode, fieldMode]);

      useEffect(() => {
        const map = mapRef.current;

        if (!map || !fieldMode || !fieldLocation) {
          userMarkerRef.current?.remove();
          userMarkerRef.current = null;
          return;
        }

        if (!userMarkerRef.current) {
          const element = document.createElement("div");
          element.className = "field-user-marker";
          element.setAttribute(
              "aria-label",
              "Tu ubicación",
          );

          element.innerHTML = `
          <span class="field-user-marker-pulse"></span>
          <span class="field-user-marker-body">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="3.2"></circle>
              <path d="M6.8 19.2c.7-4 2.4-6 5.2-6s4.5 2 5.2 6"></path>
            </svg>
          </span>
        `;

          userMarkerRef.current =
              new Marker({
                element,
                anchor: "center",
              })
                  .setLngLat([
                    fieldLocation.longitude,
                    fieldLocation.latitude,
                  ])
                  .addTo(map);
        } else {
          userMarkerRef.current.setLngLat([
            fieldLocation.longitude,
            fieldLocation.latitude,
          ]);
        }

        return () => {
          if (!fieldMode) {
            userMarkerRef.current?.remove();
            userMarkerRef.current = null;
          }
        };
      }, [
        fieldLocation,
        fieldMode,
      ]);

      useEffect(() => {
        const map = mapRef.current;
        if (!map?.isStyleLoaded() || !map.getLayer(PARCEL_SELECTED_LAYER_ID)) return;
        map.setFilter(PARCEL_SELECTED_LAYER_ID, [
          "==",
          ["get", "cadastral_ref"],
          selectedRc ?? "",
        ]);

        if (selectedRc && !fieldMode) {
          const selected = parcelsRef.current.find(
              (parcel) => parcel.properties.cadastral_ref === selectedRc,
          );
          if (selected) fitToFeature(map, selected);
        }
      }, [fieldMode, selectedRc]);

      useEffect(() => {
        const map = mapRef.current;
        if (!map?.isStyleLoaded()) return;

        if (!fieldMode) {
          clearFieldLayers(map);
          return;
        }

        updateFieldLayers(
            map,
            fieldLocation,
            fieldTarget,
        );
      }, [fieldLocation, fieldMode, fieldTarget]);

      return <div ref={containerRef} className="cad-map" aria-label="Mapa de parcelas" />;
    },
);
