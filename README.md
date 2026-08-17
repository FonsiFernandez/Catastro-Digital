# Catastro Digital

A modernized Docker application for looking up Spanish cadastral parcels, caching their
official geometry in PostGIS, organizing them into groups, and viewing them on an
interactive MapLibre map.

## What changed in this version

### Catastro Digital 1.2

- Add parcels directly from the map: activate **Añadir desde mapa**, click inside a cadastral parcel, review the highlighted boundary and save it.
- Existing saved parcels are detected locally before Catastro is queried.
- Three base-map views: **Mapa (OpenStreetMap)**, **Ortofoto PNOA máxima actualidad**, and **Topográfico IGN**.
- Selecting from the map automatically enables the cadastral boundary overlay.
- The selected basemap is persisted in `localStorage`.
- A temporary preview layer makes it clear which cadastral polygon will be saved.


### Frontend

- Next.js 16.3.1 and React 19.2.8.
- Node.js 24 LTS production image.
- MapLibre GL JS 6.3.0.
- TypeScript 5.9.3 pinned explicitly (no npm alias / auto-install loop).
- Production multi-stage Next.js standalone Docker image instead of `next dev`.
- Same-origin `/api/*` proxy from Next.js to FastAPI.
- `Map.tsx` has been split into map, sidebar, hooks, API client, domain types and UI components.
- Fixed GIS-style sidebar and a map-first layout.
- Search validation, loading states, notifications and request timeouts.
- Collapsible groups with show/hide, rename and delete actions.
- Parcel filtering by name/reference.
- Dedicated parcel inspector for name, group, color, copy reference, center, delete and restore.
- Optimistic updates for fast editing, followed by server reconciliation.
- Layer and deleted-parcel preferences persist in `localStorage`.
- Responsive mobile layout.
- OpenStreetMap base tiles are defined directly in MapLibre instead of depending on a remote style JSON.

### API / database

- FastAPI, Uvicorn, SQLAlchemy, Psycopg, GeoAlchemy2, Shapely and HTTPX updated.
- FastAPI lifespan startup replaces the old startup event.
- Complete SQLAlchemy schema for `parcels` and `parcel_groups`.
- Idempotent legacy schema upgrades preserve existing Docker database volumes.
- `pgcrypto` enables UUID defaults for groups.
- Group deletion is supported; its parcels automatically become ungrouped.
- Better UUID, reference and color validation.
- Parcel mutations now update `updated_at` and return 404 when no record was changed.
- Existing 14-character references can reuse cached 20-character parcel variants.
- Catastro WFS/WMS calls have clearer timeouts, errors and HTTP clients.

## Run with Docker

From the project root:

```powershell
docker compose down
docker compose up -d --build
```

Then check:

```powershell
docker compose ps
```

Expected services:

```text
cadweb_db    healthy
cadweb_api   healthy
cadweb_web   healthy
```

Open:

- Web: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`
- API health: `http://localhost:8000/health`

### Existing installation

You do **not** need to delete the `db_data` volume. On API startup the schema updater adds
the missing columns/tables used by the current application while retaining existing parcels.

For an extra-safe upgrade, back up your database volume first. Do not run
`docker compose down -v` unless you intentionally want to delete all stored parcel data.

## Optional environment configuration

Copy `.env.example` to `.env` to override ports or PostgreSQL credentials.

```text
POSTGRES_DB=cadweb
POSTGRES_USER=cadweb
POSTGRES_PASSWORD=cadweb
WEB_PORT=3000
API_PORT=8000
DB_PORT=5432
```

## Frontend development outside Docker

Use Node.js 24.x.

```powershell
cd web
npm install
$env:INTERNAL_API_URL="http://localhost:8000"
npm run dev
```

For a production-style validation:

```powershell
npm run check
```

`npm run check` performs TypeScript validation and a Next.js production build.

## Backend development outside Docker

Python 3.12 is used by the Docker image. PostGIS and GDAL/`ogr2ogr` are required.

```powershell
cd api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Data sources

- Spanish Cadastre INSPIRE WFS for parcel geometries.
- Spanish Cadastre WMS for cadastral boundary overlay.
- OpenStreetMap raster tiles for the street base map.
- IGN/CNIG PNOA Máxima Actualidad orthoimagery for aerial terrain inspection.
- IGN raster cartography for the topographic base map.

## Project structure

```text
Catastro-Digital/
├─ docker-compose.yml
├─ .env.example
├─ ARCHITECTURE.md
├─ api/
│  ├─ Dockerfile
│  ├─ requirements.txt
│  └─ app/
│     ├─ db.py
│     ├─ main.py
│     ├─ models.py
│     ├─ routers/
│     └─ services/
└─ web/
   ├─ Dockerfile
   ├─ package.json
   ├─ next.config.ts
   ├─ tsconfig.json
   └─ src/
      ├─ app/
      ├─ components/
      │  ├─ map/
      │  ├─ sidebar/
      │  └─ ui/
      ├─ hooks/
      ├─ lib/
      └─ types/
```

See `ARCHITECTURE.md` for the application flow and module responsibilities.


## Frontend bundler compatibility

The project uses Next.js 16 with webpack explicitly (`next dev --webpack` / `next build --webpack`).
MapLibre GL JS 6 is ESM-only and its worker is configured with `setWorkerUrl(...)` following
the MapLibre webpack setup. This avoids the currently unresolved MapLibre 6 + Next Turbopack
worker integration issue while keeping the application on Next.js 16.

## MapLibre 6 + Next.js worker note

MapLibre GL JS 6 is ESM-only. In Next.js, its worker and `maplibre-gl-shared.mjs`
must be served together from the same public directory. The `predev` and
`prebuild` npm lifecycle scripts run `web/scripts/copy-maplibre-worker.mjs`, which
copies both files from the installed MapLibre package into `web/public/maplibre/`.
Do not replace this with a `new URL(..., import.meta.url)` worker setup in Next.js.

## Backups and data portability

Catastro Digital 1.1 adds backup and restore directly to the sidebar under **Datos y copias**.

- **Backup** downloads a versioned `catastro-digital-backup_YYYY-MM-DD_HHMM.json` file containing all groups and all parcels, including deleted parcels, styles, group assignments, timestamps and full WGS84 geometry.
- **GeoJSON** downloads all parcel geometries and useful properties for GIS interoperability. GeoJSON is an export format, not the restore format.
- **Importar** accepts Catastro Digital backup JSON files. The backend validates the complete document and every geometry before writing anything.
- **Combinar** upserts the objects present in the backup while leaving other current data untouched.
- **Reemplazar todo** deletes current application data and recreates it from the backup. The UI requires an explicit destructive-action confirmation.

Imports are transactional: if any database write fails, PostgreSQL rolls back the complete import.

For disaster recovery outside the application, a PostgreSQL `pg_dump` is still the strongest infrastructure-level backup. The in-app JSON backup is designed for convenient, portable backup/restore of Catastro Digital application data.


## Add a parcel from the map

1. Click **Añadir desde mapa** in the map toolbar.
2. Catastro boundaries are enabled automatically.
3. Click inside the parcel you want to keep.
4. The API queries a small official Catastro WFS BBOX around that point and selects the polygon that actually contains the click.
5. Review the amber preview outline.
6. Click **Guardar parcela**. The normal parcel lookup/cache flow stores the official geometry in PostGIS.

The original cadastral-reference search remains available and is useful when you already know the reference.

## Basemap views

- **Mapa** — OpenStreetMap, best for roads and place context.
- **Ortofoto** — PNOA Máxima Actualidad from Spain's IGN/CNIG, best for seeing field boundaries, vegetation, buildings and access tracks.
- **Topográfico** — official IGN raster cartography, useful for terrain context and traditional map reading.

The Catastro boundary layer is independent of the basemap, so it can be overlaid on the PNOA orthoimage for the clearest parcel inspection.
