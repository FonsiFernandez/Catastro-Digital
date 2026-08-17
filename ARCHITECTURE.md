# Architecture

## Request flow

```text
Browser
  │
  ├─ UI + map ───────────────► Next.js 16
  │                              │
  │   /api/* (same origin)       │ rewrite
  └──────────────────────────────┼────────► FastAPI
                                 │            │
                                 │            ├─ PostGIS cache / metadata
                                 │            ├─ Catastro WFS (parcel lookup)
                                 │            └─ Catastro WMS (map overlay proxy)
                                 │
                                 └─ OpenStreetMap raster base layer
```

The browser no longer needs to know the Docker API hostname or a public API URL. The
Next.js server proxies `/api/*` to `INTERNAL_API_URL`, which is `http://api:8000` in
Docker Compose and can be `http://localhost:8000` during local frontend development.

## Frontend structure

- `src/components/CadastreApp.tsx` — application orchestration and UI preferences.
- `src/components/map/CadastreMap.tsx` — MapLibre lifecycle, sources, layers and fit operations.
- `src/components/sidebar/*` — search, layers, parcel library and selected parcel inspector.
- `src/hooks/useCadastreData.ts` — server data and mutations with optimistic updates.
- `src/lib/api.ts` — HTTP client, timeouts and normalized API errors.
- `src/lib/map.ts` — map constants and geometry helpers.
- `src/types/cadastre.ts` — shared frontend domain types.

## Backend structure

The existing FastAPI service remains intentionally simple, but its database schema now
matches what the routers actually use. `init_db()` creates PostGIS/pgcrypto, creates a
fresh schema, and applies idempotent `ADD COLUMN IF NOT EXISTS` upgrades for early
Docker volumes.

For a larger multi-user deployment, the next logical step would be Alembic migrations
and authentication. The current startup migration is designed specifically to make this
single-user Docker project upgrade without deleting its existing `db_data` volume.

## Backup subsystem

`api/app/routers/backup.py` owns logical data portability. The format is versioned (`catastro-digital-backup`, version `1`) so future schema migrations can remain backward-compatible.

The import path has two phases: validation and transactional persistence. Pydantic validates document structure and identifiers, while PostGIS validates all GeoJSON geometries before any destructive operation occurs. Replace-mode deletion and all inserts/upserts happen in one SQLAlchemy transaction.

The frontend implementation lives in `web/src/components/sidebar/DataTools.tsx`. It performs a lightweight client-side format check, calls the server dry-run validation endpoint, then exposes merge or replace semantics to the user.

## Land metrics and field navigation (v1.3)

Parcel list responses calculate `ST_Area(geom_official::geography)` and `ST_Perimeter(geom_official::geography)` on demand. Group responses aggregate active parcel area and calculate the perimeter of the unioned group geometry.

Field navigation has two independent data streams:

1. `useFieldLocation` uses the browser Geolocation API and keeps the latest device location/accuracy.
2. `POST /parcels/field-position` resolves that point against PostGIS. If a parcel is selected, it is the target; otherwise the API prefers a saved parcel covering the point and falls back to the nearest saved parcel within 500 m.

The API returns the closest boundary point and the geodesic boundary distance. `CadastreMap` draws the user position, accuracy circle, target parcel and a guide line to the closest boundary point.
