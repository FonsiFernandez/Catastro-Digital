# 🏗️ Arquitectura — Catastro Digital v1.0.0

## 1. Objetivo arquitectónico

La v1.0.0 está diseñada alrededor de cuatro principios:

1. **Guest-first**: la aplicación funciona sin cuenta.
2. **Cuenta opcional**: autenticarse añade persistencia remota y sincronización.
3. **Separación entre geometría oficial y datos personales**.
4. **Una misma API para la web autenticada y futuras aplicaciones nativas**.

---

## 2. Vista de alto nivel

```mermaid
flowchart LR
    subgraph Client["Cliente"]
        W["Next.js / React"]
        IDB[("IndexedDB")]
        MAP["MapLibre GL"]
    end

    subgraph Backend["Backend"]
        API["FastAPI"]
        AUTH["Auth / JWT"]
        GEO["Servicios geoespaciales"]
    end

    subgraph Data["Persistencia"]
        PG[("PostgreSQL")]
        POSTGIS[("PostGIS")]
    end

    subgraph External["Servicios externos"]
        CAT["Catastro WFS/WMS"]
        IGN["IGN / CNIG / PNOA"]
        OSM["OpenStreetMap"]
    end

    W --> IDB
    W --> MAP
    W -->|HTTPS / API| API
    API --> AUTH
    API --> GEO
    API --> PG
    PG --> POSTGIS
    API --> CAT
    MAP --> IGN
    MAP --> OSM
```

---

## 3. Componentes principales

| Capa | Tecnología | Responsabilidad |
|---|---|---|
| Web | Next.js + React + TypeScript | UI, navegación, estado, mapa |
| Mapa | MapLibre GL JS | Visualización geográfica |
| Guest storage | IndexedDB | Persistencia local sin cuenta |
| API | FastAPI | Auth, parcelas, grupos, backups, spatial queries |
| ORM | SQLAlchemy + GeoAlchemy2 | Persistencia y geometrías |
| DB | PostgreSQL + PostGIS | Datos multiusuario y operaciones GIS |
| Migraciones | Alembic | Versionado del esquema |
| Contenedores | Docker Compose | Entorno reproducible |

---

## 4. Dos modos de funcionamiento

```mermaid
flowchart TD
    START["Abrir aplicación"] --> TOKEN{"¿JWT válido?"}

    TOKEN -- No --> GUEST["Modo invitado"]
    TOKEN -- Sí --> AUTH["Modo autenticado"]

    GUEST --> IDB["IndexedDB"]
    AUTH --> API["FastAPI"]
    API --> DB[("PostgreSQL / PostGIS")]

    GUEST --> MAP["Mapa / Modo Campo"]
    AUTH --> MAP
```

### Invitado

Los datos personales permanecen en el navegador:

- parcelas;
- geometrías;
- grupos;
- nombre;
- notas;
- color;
- estado eliminado.

No se crea ningún usuario anónimo en backend.

### Cuenta

Los datos personales quedan asociados al `user_id` autenticado.

---

## 5. Modelo de datos

```mermaid
erDiagram
    USERS ||--o{ USER_PARCELS : owns
    USERS ||--o{ PARCEL_GROUPS : owns
    CADASTRAL_PARCELS ||--o{ USER_PARCELS : referenced_by
    PARCEL_GROUPS ||--o{ USER_PARCELS : groups

    USERS {
        uuid id PK
        string email
        string display_name
        string password_hash
    }

    CADASTRAL_PARCELS {
        string cadastral_ref PK
        multipolygon geom_official
        datetime create_date
        datetime modify_date
    }

    PARCEL_GROUPS {
        uuid id PK
        uuid user_id FK
        string name
    }

    USER_PARCELS {
        uuid id PK
        uuid user_id FK
        string cadastral_ref FK
        uuid group_id FK
        string name
        string notes
        string color
        boolean is_deleted
    }
```

### Separación clave

`cadastral_parcels` representa la geometría oficial reutilizable.

`user_parcels` representa la capa personal del usuario.

Esto evita duplicar una misma geometría para cada usuario y, al mismo tiempo, mantiene aislados:

- nombres;
- notas;
- colores;
- grupos;
- estado eliminado.

---

## 6. Flujo de autenticación

```mermaid
sequenceDiagram
    participant U as Usuario
    participant W as Web
    participant A as FastAPI
    participant D as PostgreSQL

    U->>W: Email + contraseña
    W->>A: POST /auth/login
    A->>D: Buscar usuario
    D-->>A: Usuario + password hash
    A->>A: Verificar Argon2
    A-->>W: JWT + usuario
    W->>W: Guardar token
    W->>A: GET /users/me
    A-->>W: Sesión válida
```

---

## 7. Flujo guest → account

```mermaid
flowchart TD
    A["Datos guest en IndexedDB"] --> L["Login / Registro"]
    L --> D{"¿Hay datos locales?"}
    D -- No --> ACCOUNT["Usar datos de cuenta"]
    D -- Sí --> PREVIEW["Vista previa de migración"]
    PREVIEW --> CONFLICT{"¿Conflictos de grupos?"}
    CONFLICT -- Sí --> RESOLVE["Reutilizar / Renombrar"]
    CONFLICT -- No --> IMPORT["Importar"]
    RESOLVE --> IMPORT
    IMPORT --> OK{"¿Importación correcta?"}
    OK -- Sí --> CLEAR["Borrar datos guest"]
    OK -- No --> KEEP["Mantener datos guest"]
```

Regla importante: **los datos locales solo se eliminan tras una migración completamente correcta**.

---

## 8. Mapa e interacción geográfica

La web utiliza una única instancia persistente de MapLibre siempre que sea posible.

```mermaid
flowchart LR
    CLICK["Click / Tap"] --> SAVED{"¿Parcela ya guardada?"}
    SAVED -- Sí --> OPEN["Abrir detalle"]
    SAVED -- No --> IDENTIFY["Identificar por coordenadas"]
    IDENTIFY --> PREVIEW["Previsualizar geometría"]
    PREVIEW --> SAVE{"¿Guardar?"}
    SAVE -- Sí --> LIB["Añadir a biblioteca"]
    SAVE -- No --> MAP["Volver al mapa"]
```

Funciones:

- seleccionar desde lista;
- seleccionar desde mapa;
- encuadrar una parcela;
- encuadrar todas;
- identificar por coordenadas;
- mostrar Catastro;
- cambiar mapa base.

---

## 9. Mapas base y capas

```mermaid
flowchart TD
    MAP["MapLibre"] --> BASE["Mapa base"]
    BASE --> STREET["Callejero"]
    BASE --> AERIAL["Ortofoto"]
    BASE --> TOPO["Topográfico"]

    MAP --> OVERLAY["Capas"]
    OVERLAY --> SAVED["Parcelas guardadas"]
    OVERLAY --> CATASTRO["Límites Catastro"]
    OVERLAY --> FIELD["GPS / Modo Campo"]
```

La capa Catastro puede fallar temporalmente sin invalidar los datos guardados.

---

## 10. Métricas geográficas

En cuenta autenticada, las métricas se calculan a partir de geometrías PostGIS:

- superficie;
- hectáreas;
- perímetro;
- distancias espaciales;
- contención de puntos.

```mermaid
flowchart LR
    GEO["Geometría parcela"] --> PG["PostGIS"]
    PG --> AREA["Área"]
    PG --> PER["Perímetro"]
    PG --> DIST["Distancia"]
    PG --> CONTAINS["Dentro / Fuera"]
```

En modo invitado, las operaciones necesarias para Modo Campo se realizan localmente sobre las geometrías guardadas.

---

## 11. Navegación móvil

```mermaid
stateDiagram-v2
    [*] --> Inicio
    Inicio --> Parcelas
    Inicio --> Campo
    Inicio --> Herramientas
    Inicio --> Mas

    Parcelas --> DetalleParcela
    DetalleParcela --> Parcelas
    DetalleParcela --> Inicio
    DetalleParcela --> Campo
    DetalleParcela --> Herramientas
    DetalleParcela --> Mas

    Campo --> Inicio
    Campo --> Parcelas
    Campo --> Herramientas
    Campo --> Mas
```

Barra inferior:

```text
Inicio · Parcelas · Campo · Herramientas · Más
```

Los grupos no son una pestaña independiente; se gestionan dentro de `Parcelas`.

---

## 12. Backup y portabilidad

```mermaid
flowchart LR
    DATA["Datos usuario"] --> JSON["Backup v3 JSON"]
    DATA --> GEOJSON["GeoJSON"]
    JSON --> RESTORE["Restauración"]
    GEOJSON --> GIS["QGIS / ArcGIS / otros GIS"]
```

Más detalle en [BACKUP.md](./BACKUP.md).

---

## 13. Servicios externos

| Servicio | Uso |
|---|---|
| Dirección General del Catastro | geometría, referencia, WFS/WMS |
| IGN / CNIG | cartografía |
| PNOA | ortofotografía |
| OpenStreetMap | mapa base |

Estos servicios son externos y pueden:

- estar temporalmente caídos;
- responder lentamente;
- devolver información incompleta;
- cambiar su disponibilidad.

---

## 14. Migraciones de base de datos

Alembic versiona el esquema.

Evolución relevante de v1:

```mermaid
flowchart LR
    B["Baseline"] --> U["Users"]
    U --> GO["Group ownership"]
    GO --> GM["Group data migration"]
    GM --> CP["cadastral_parcels"]
    CP --> UP["user_parcels"]
    UP --> DROP["Drop legacy parcels"]
```

---

## 15. Dirección futura

La API se ha diseñado para poder ser reutilizada por una futura aplicación móvil:

```mermaid
flowchart TD
    API["FastAPI"]
    WEB["Web<br/>Next.js + IndexedDB"]
    MOBILE["Mobile<br/>React Native + Expo + SQLite"]
    DB[("PostgreSQL / PostGIS")]

    WEB --> API
    MOBILE --> API
    API --> DB
```

La app nativa no forma parte de v1.0.0.
