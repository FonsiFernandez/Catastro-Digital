# Map selection and terrain views

Catastro Digital 1.2 adds two related GIS workflows.

## Click-to-save

The browser sends the clicked WGS84 coordinate to `POST /parcels/identify`. The API first checks existing PostGIS geometries with `ST_Covers`. If no saved parcel contains the point, it converts the click to EPSG:3857 and requests a small BBOX from the official Spanish Cadastre INSPIRE WFS. GDAL converts the returned GML features to EPSG:4326 and Shapely selects the polygon covering the click.

Identification does not write to the database. The amber polygon is only a preview. `Guardar parcela` then uses the existing `/parcels/lookup` path, which stores the official geometry in PostGIS.

## Basemaps

The MapLibre style keeps all basemap sources loaded in one style and switches layer visibility, so parcel/cadastre application layers remain intact when the user changes view.

Available views:

- OpenStreetMap street map
- IGN/CNIG PNOA Máxima Actualidad orthoimagery
- IGN topographic raster map

The PNOA and topographic tile services use TMS y-axis addressing; MapLibre's raster `scheme: "tms"` handles the inversion.
