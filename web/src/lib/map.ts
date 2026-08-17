import {
  LngLatBounds,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import type { Feature, LineString, Point, Polygon } from "geojson";
import type { BaseMapId, DeviceLocation, FieldTarget, ParcelFeature, ParcelFeatureCollection } from "@/types/cadastre";

export const DEFAULT_PARCEL_COLOR = "#7c3aed";

export const BASE_LAYER_IDS: Record<BaseMapId, string> = {
  street: "base-street",
  aerial: "base-aerial",
  topographic: "base-topographic",
};

export const BASE_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    "osm-street": {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
      maxzoom: 19,
    },
    "ign-pnoa": {
      type: "raster",
      // Official IGN/CNIG PNOA Maximum Currentness XYZ/TMS service.
      tiles: ["https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{y}.jpeg"],
      tileSize: 256,
      scheme: "tms",
      attribution: "© Instituto Geográfico Nacional de España (PNOA)",
      maxzoom: 19,
    },
    "ign-topographic": {
      type: "raster",
      tiles: ["https://tms-mapa-raster.ign.es/1.0.0/mapa-raster/{z}/{x}/{y}.jpeg"],
      tileSize: 256,
      scheme: "tms",
      attribution: "© Instituto Geográfico Nacional de España",
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: BASE_LAYER_IDS.street,
      type: "raster",
      source: "osm-street",
    },
    {
      id: BASE_LAYER_IDS.aerial,
      type: "raster",
      source: "ign-pnoa",
      layout: { visibility: "none" },
    },
    {
      id: BASE_LAYER_IDS.topographic,
      type: "raster",
      source: "ign-topographic",
      layout: { visibility: "none" },
    },
  ],
};

export const PARCEL_SOURCE_ID = "parcels";
export const PARCEL_FILL_LAYER_ID = "parcels-fill";
export const PARCEL_LINE_LAYER_ID = "parcels-line";
export const PARCEL_SELECTED_LAYER_ID = "parcel-selected-line";
export const PARCEL_PREVIEW_SOURCE_ID = "parcel-preview";
export const PARCEL_PREVIEW_FILL_LAYER_ID = "parcel-preview-fill";
export const PARCEL_PREVIEW_LINE_LAYER_ID = "parcel-preview-line";
export const CATASTRO_SOURCE_ID = "catastro-wms";
export const CATASTRO_LAYER_ID = "catastro-wms-layer";
export const FIELD_ACCURACY_SOURCE_ID = "field-accuracy";
export const FIELD_ACCURACY_FILL_LAYER_ID = "field-accuracy-fill";
export const FIELD_ACCURACY_LINE_LAYER_ID = "field-accuracy-line";
export const FIELD_LOCATION_SOURCE_ID = "field-location";
export const FIELD_LOCATION_LAYER_ID = "field-location-point";
export const FIELD_BOUNDARY_SOURCE_ID = "field-boundary-guide";
export const FIELD_BOUNDARY_LINE_LAYER_ID = "field-boundary-line";
export const FIELD_BOUNDARY_POINT_LAYER_ID = "field-boundary-point";
export const FIELD_TARGET_LAYER_ID = "field-target-line";

export function setBaseMapVisibility(map: MapLibreMap, baseMap: BaseMapId): void {
  for (const [id, layerId] of Object.entries(BASE_LAYER_IDS) as [BaseMapId, string][]) {
    if (!map.getLayer(layerId)) continue;
    map.setLayoutProperty(layerId, "visibility", id === baseMap ? "visible" : "none");
  }
}

export function asFeatureCollection(features: ParcelFeature[]): ParcelFeatureCollection {
  return { type: "FeatureCollection", features };
}

function isValidLngLat(coordinate: readonly number[]): coordinate is [number, number] {
  if (coordinate.length < 2) return false;
  const [lng, lat] = coordinate;
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

/** Extend bounds with every valid coordinate in a parcel geometry.
 *
 * Catastro data should already be EPSG:4326. Invalid coordinates are ignored so
 * a malformed geometry cannot send the camera thousands of kilometres away.
 */
export function extendBoundsWithFeature(
  bounds: LngLatBounds,
  feature: ParcelFeature,
): number {
  const geometry = feature.geometry;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let validCoordinates = 0;

  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const coordinate of ring) {
        if (!isValidLngLat(coordinate)) continue;
        bounds.extend(coordinate);
        validCoordinates += 1;
      }
    }
  }

  return validCoordinates;
}

export function featureBounds(feature: ParcelFeature): LngLatBounds | null {
  const bounds = new LngLatBounds();
  const count = extendBoundsWithFeature(bounds, feature);
  return count > 0 && !bounds.isEmpty() ? bounds : null;
}

export function fitToFeature(map: MapLibreMap, feature: ParcelFeature): boolean {
  const bounds = featureBounds(feature);
  if (!bounds) {
    console.error("Parcel has no valid EPSG:4326 coordinates", feature);
    return false;
  }

  map.fitBounds(bounds, {
    padding: { top: 72, right: 72, bottom: 72, left: 72 },
    maxZoom: 18,
    duration: 650,
  });
  return true;
}

export function fitToFeatures(map: MapLibreMap, features: ParcelFeature[]): boolean {
  if (!features.length) return false;

  const bounds = new LngLatBounds();
  let validCoordinates = 0;
  for (const feature of features) {
    validCoordinates += extendBoundsWithFeature(bounds, feature);
  }

  if (!validCoordinates || bounds.isEmpty()) return false;

  map.fitBounds(bounds, {
    padding: { top: 72, right: 72, bottom: 72, left: 72 },
    maxZoom: 16,
    duration: 700,
  });
  return true;
}


const EARTH_RADIUS_M = 6_371_008.8;

export function locationPointFeature(location: DeviceLocation): Feature<Point> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "Point",
      coordinates: [location.longitude, location.latitude],
    },
  };
}

export function accuracyCircleFeature(location: DeviceLocation, steps = 64): Feature<Polygon> {
  const safeAccuracy = Number.isFinite(location.accuracy)
    ? Math.min(Math.max(location.accuracy, 1), 5000)
    : 100;
  const angularDistance = safeAccuracy / EARTH_RADIUS_M;
  const lat1 = (location.latitude * Math.PI) / 180;
  const lon1 = (location.longitude * Math.PI) / 180;
  const coordinates: [number, number][] = [];

  for (let index = 0; index <= steps; index += 1) {
    const bearing = (2 * Math.PI * index) / steps;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance)
      + Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const lon2 = lon1 + Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );
    coordinates.push([(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }

  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [coordinates] },
  };
}

export function boundaryGuideFeature(
  location: DeviceLocation,
  target: FieldTarget,
): Feature<LineString> {
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: [
        [location.longitude, location.latitude],
        target.nearest_boundary.coordinates,
      ],
    },
  };
}
