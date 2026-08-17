# Upgrade from the current Catastro Digital project

This version is designed to reuse your existing Docker/PostGIS data.

## 1. Back up the database first

With the current stack running:

```powershell
docker compose exec db pg_dump -U cadweb -d cadweb -f /tmp/catastro_backup.sql
docker cp cadweb_db:/tmp/catastro_backup.sql .\catastro_backup.sql
```

Keep that file until you have verified the upgraded application.

## 2. Replace the project files

Copy the contents of this package over the repository working tree. Preserve your own
`.env` if you already use one.

Do not copy old `web/node_modules` or `.next` directories into the new project.

## 3. Rebuild without old Next.js layers

From the repository root:

```powershell
docker compose down
docker compose build --no-cache
docker compose up -d
```

**Do not use `docker compose down -v`.** The `-v` option deletes the database volume.

## 4. Verify the stack

```powershell
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 web
```

The database, API and web services should all become healthy.

Open:

```text
http://localhost:3000
```

API documentation remains available at:

```text
http://localhost:8000/docs
```

## 5. What happens to the existing database

At API startup, `init_db()`:

1. enables PostGIS and `pgcrypto` if needed;
2. creates missing `parcel_groups` / `parcels` schema for a fresh install;
3. adds missing metadata, notes, grouping and soft-delete columns to legacy tables;
4. normalizes defaults and null values;
5. adds the group foreign key and indexes if missing.

The migration uses `IF NOT EXISTS` and does not drop parcel data.


## 6. Version 1.3 database change

Version 1.3 adds one nullable `notes` column to `parcels`. The API startup migration creates it automatically with `ADD COLUMN IF NOT EXISTS`, so existing parcel data and geometries are retained.

The new area/perimeter values are calculated from the existing PostGIS geometry when data is requested; they are not duplicated into new database columns.
