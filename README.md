# Catastro Digital

A modernized Docker application for looking up Spanish cadastral parcels, caching their
official geometry in PostGIS, organizing them into groups, and viewing them on an
interactive MapLibre map.

## What changed in this version

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
- OpenStreetMap raster tiles for the base map.

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
