# Backup & restore

Catastro Digital 1.1 provides logical application backups from the sidebar.

## Backup JSON

Use **Datos y copias → Backup**. The downloaded file contains:

- all parcel groups and group visibility settings;
- all parcels, including soft-deleted parcels;
- cadastral reference, custom name, colour and group assignment;
- full parcel geometry in WGS84 GeoJSON;
- created/updated/fetched/deleted timestamps.

The file is versioned as `catastro-digital-backup` format version `2`. Version 2 adds parcel notes; the importer remains compatible with version 1 backups.

## Restore / import

Use **Datos y copias → Importar** and select a Catastro Digital backup JSON file.

- **Combinar**: add/update objects from the backup and keep unrelated current objects.
- **Reemplazar todo**: delete current Catastro Digital data and recreate it exactly from the backup.

The server validates the complete document and all geometries before writing. The write itself is one PostgreSQL transaction, so a failed import is rolled back completely.

## GeoJSON

Use **GeoJSON** for GIS interoperability. It is not intended as the application restore format because the versioned backup JSON carries more application metadata.

## Infrastructure backup

For disaster recovery of the entire PostgreSQL database, continue to use `pg_dump` in addition to in-app backups.
