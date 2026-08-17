import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from "geojson";

export type ParcelProperties = {
  cadastral_ref: string;
  name: string | null;
  notes: string | null;
  color: string | null;
  group_id: string | null;
  is_deleted: boolean;
  area_m2: number | null;
  area_ha: number | null;
  perimeter_m: number | null;
  source?: string;
  srs_in?: string;
};

export type ParcelFeature = Feature<Polygon | MultiPolygon, ParcelProperties>;
export type ParcelFeatureCollection = FeatureCollection<Polygon | MultiPolygon, ParcelProperties>;

export type BaseMapId = "street" | "aerial" | "topographic";

export type ParcelIdentification = {
  parcel: ParcelFeature;
  already_saved: boolean;
};

export type ParcelGroup = {
  id: string;
  name: string;
  is_hidden: boolean;
  parcel_count: number;
  area_m2: number;
  area_ha: number;
  perimeter_m: number;
};

export type NoticeState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

export type ParcelUpdate = Partial<
  Pick<ParcelProperties, "name" | "notes" | "color" | "group_id" | "is_deleted">
>;

export type GroupUpdate = Partial<Pick<ParcelGroup, "name" | "is_hidden">>;

export type BackupGroup = Pick<ParcelGroup, "id" | "name" | "is_hidden"> & {
  created_at: string | null;
  updated_at: string | null;
};

export type BackupParcel = {
  cadastral_ref: string;
  name: string | null;
  notes?: string | null;
  color: string;
  group_id: string | null;
  is_deleted: boolean;
  geometry: ParcelFeature["geometry"];
  created_at: string | null;
  updated_at: string | null;
  last_fetched_at: string | null;
  deleted_at: string | null;
};

export type BackupDocument = {
  format: "catastro-digital-backup";
  version: 1 | 2;
  exported_at: string;
  groups: BackupGroup[];
  parcels: BackupParcel[];
};

export type ImportMode = "merge" | "replace";

export type BackupImportResult = {
  ok: boolean;
  dry_run: boolean;
  mode: ImportMode;
  groups: number;
  parcels: number;
};

export type FieldTarget = {
  parcel: ParcelFeature;
  group_name: string | null;
  inside: boolean;
  boundary_distance_m: number;
  nearest_boundary: Point;
};

export type FieldPositionResult = {
  target: FieldTarget | null;
  search_radius_m: number;
};

export type DeviceLocation = {
  longitude: number;
  latitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
};
