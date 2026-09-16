# 💾 Backup, exportación e importación — v1.0.0

## 1. Objetivo

Catastro Digital incluye dos mecanismos distintos:

| Mecanismo | Objetivo |
|---|---|
| **Backup JSON v3** | restaurar Catastro Digital |
| **GeoJSON** | interoperabilidad GIS |

> GeoJSON no sustituye al backup propio.

---

## 2. Backup v3

Nombre habitual:

```text
catastro-digital-backup_YYYY-MM-DD_HHMM.json
```

Puede contener:

- parcelas;
- geometrías;
- nombres;
- notas;
- colores;
- grupos;
- estado eliminado;
- fechas;
- metadatos de restauración.

```mermaid
flowchart TD
    DATA["Biblioteca Catastro Digital"] --> GROUPS["Grupos"]
    DATA --> PARCELS["Parcelas"]
    DATA --> META["Metadatos"]
    PARCELS --> GEOM["Geometrías"]
    PARCELS --> PERSONAL["Nombre / Notas / Color"]
    GROUPS --> JSON["Backup v3"]
    GEOM --> JSON
    PERSONAL --> JSON
    META --> JSON
```

---

## 3. Exportación según modo

```mermaid
flowchart LR
    MODE{"Modo"}
    MODE -- Guest --> IDB[("IndexedDB")]
    MODE -- Cuenta --> API["FastAPI"]
    API --> DB[("PostgreSQL / PostGIS")]

    IDB --> EXPORT["Generar backup"]
    DB --> EXPORT
    EXPORT --> FILE[".json"]
```

### Guest

- exportación local;
- no requiere backend;
- especialmente importante si el usuario no tiene cuenta.

### Cuenta

- exportación limitada al usuario autenticado;
- el backend nunca debe mezclar datos de distintos usuarios.

---

## 4. Importación

```mermaid
flowchart TD
    FILE["Backup JSON"] --> VALIDATE["Validar estructura"]
    VALIDATE --> MODE{"Modo de importación"}

    MODE -- Merge --> MERGE["Añadir / Actualizar"]
    MODE -- Replace --> CONFIRM["Confirmación adicional"]
    CONFIRM --> REPLACE["Sustituir estado actual"]

    MERGE --> RESULT["Refrescar biblioteca"]
    REPLACE --> RESULT
```

### Merge

Conserva datos existentes y combina el contenido del backup.

### Replace

Sustituye el estado actual del usuario.

Debe tratarse como una operación destructiva y requerir confirmación.

---

## 5. Relaciones entre grupos y parcelas

```mermaid
flowchart LR
    G["Grupo"] --> P1["Parcela A"]
    G --> P2["Parcela B"]
    G --> P3["Parcela C"]
```

Al restaurar:

- deben recuperarse primero los grupos;
- después las parcelas;
- finalmente sus relaciones.

Si un grupo se elimina desde la aplicación, sus parcelas permanecen y pasan a **Sin grupo**.

---

## 6. Parcelas eliminadas

`is_deleted` forma parte del estado del usuario.

Por ello una parcela borrada puede aparecer en un backup y ser recuperada posteriormente mediante:

```text
Mostrar borradas → Restaurar
```

---

## 7. GeoJSON

```mermaid
flowchart LR
    CD["Catastro Digital"] --> GJ["GeoJSON"]
    GJ --> QGIS["QGIS"]
    GJ --> ARCGIS["ArcGIS"]
    GJ --> OTHER["Otros GIS"]
```

GeoJSON está pensado para:

- reutilizar geometrías;
- análisis GIS;
- intercambio con otras herramientas.

No garantiza conservar todos los metadatos internos necesarios para restaurar la aplicación.

---

## 8. Migración guest → account

Este flujo es distinto a importar manualmente un backup.

```mermaid
sequenceDiagram
    participant G as IndexedDB
    participant W as Web
    participant A as API
    participant D as DB

    W->>G: Detectar datos guest
    G-->>W: Parcelas + grupos
    W->>W: Preparar preview
    W->>W: Resolver conflictos
    W->>A: Importar a cuenta
    A->>D: Persistir
    D-->>A: OK
    A-->>W: Migración correcta
    W->>G: Borrar datos guest
```

### Regla de seguridad

Si cualquier parte falla:

```text
NO borrar datos guest
```

---

## 9. Conflictos de grupos

Cuando un grupo local tiene el mismo nombre que uno remoto:

```mermaid
flowchart TD
    C["Conflicto de grupo"] --> D{"Decisión usuario"}
    D --> R["Reutilizar grupo remoto"]
    D --> N["Renombrar grupo local"]
    R --> I["Continuar importación"]
    N --> I
```

---

## 10. Backup de aplicación vs backup de infraestructura

El backup JSON protege los datos funcionales del usuario.

No sustituye:

- `pg_dump`;
- snapshots del volumen;
- backups del servidor;
- política de retención.

```mermaid
flowchart TD
    SAFE["Protección completa"] --> APP["Backup aplicación"]
    SAFE --> DB["Backup PostgreSQL"]
    SAFE --> INFRA["Backup infraestructura"]
```

---

## 11. Recomendaciones operativas

Antes de:

- desplegar;
- actualizar;
- ejecutar migraciones;
- cambiar almacenamiento;
- realizar una importación `replace`;

haz al menos:

1. backup desde Catastro Digital;
2. backup de PostgreSQL si es un servidor real;
3. verificar que ambos archivos son recuperables.
