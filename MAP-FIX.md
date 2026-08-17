# Map rendering fix

This revision fixes parcel rendering and map centering after the MapLibre GL JS 6 migration.

Changes:

- Uses the Next.js-specific MapLibre worker setup.
- Copies both `maplibre-gl-worker.mjs` and `maplibre-gl-shared.mjs` into `public/maplibre` before `dev` and `build`.
- Points `setWorkerUrl()` to `/maplibre/maplibre-gl-worker.mjs`.
- Queues center/fit requests until MapLibre has completed its `load` event.
- Validates longitude/latitude coordinates before extending bounds.
- Logs MapLibre runtime errors to the browser console.

Rebuild with:

```powershell
docker compose down
docker compose build --no-cache web
docker compose up -d
```
