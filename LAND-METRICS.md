# Land metrics

Catastro Digital 1.3 calculates measurements directly from each saved PostGIS geometry.

## Parcel metrics

Every parcel response includes:

- `area_m2`
- `area_ha`
- `perimeter_m`

The backend casts WGS84 geometry to PostGIS `geography`, so area is returned in square metres and perimeter/distance in metres.

## Group metrics

The `/groups` response also includes:

- `parcel_count`
- `area_m2`
- `area_ha`
- `perimeter_m`

Group area is the sum of active parcel areas. Group perimeter is calculated from the union of the active parcel geometries, avoiding internal shared borders where parcels form one contiguous holding.

Deleted parcels are excluded from active group metrics.
