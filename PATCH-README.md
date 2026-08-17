# Catastro Digital 1.3 patch

Apply this patch over the working Catastro Digital 1.2 project. It adds land metrics, parcel notes and mobile Field Mode.

After copying the files:

```powershell
docker compose down
docker compose up -d --build
```

Do **not** use `docker compose down -v`; the database volume contains your saved parcels.

The API startup migration adds the nullable `parcels.notes` column automatically. Area and perimeter are calculated from existing PostGIS geometry and do not require a data migration.

For phone GPS use, the site must be opened through HTTPS. See `FIELD-MODE.md`.
