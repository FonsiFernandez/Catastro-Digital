import type {
    BackupDocument,
    ParcelFeature,
    ParcelGroup,
} from "@/types/cadastre";

import { DEFAULT_PARCEL_COLOR } from "@/lib/map";

const DB_NAME = "catastro-digital";
const DB_VERSION = 1;

const PARCEL_STORE = "guest-parcels";
const GROUP_STORE = "guest-groups";

type StoredParcel = {
    cadastral_ref: string;
    feature: ParcelFeature;
    created_at: string;
    updated_at: string;
};

type StoredGroup = {
    id: string;
    name: string;
    is_hidden: boolean;
    created_at: string;
    updated_at: string;
};

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(
            DB_NAME,
            DB_VERSION,
        );

        request.onerror = () => {
            reject(
                request.error ??
                new Error("No se pudo abrir la base de datos local"),
            );
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains(PARCEL_STORE)) {
                db.createObjectStore(
                    PARCEL_STORE,
                    {
                        keyPath: "cadastral_ref",
                    },
                );
            }

            if (!db.objectStoreNames.contains(GROUP_STORE)) {
                db.createObjectStore(
                    GROUP_STORE,
                    {
                        keyPath: "id",
                    },
                );
            }
        };
    });
}

function requestResult<T>(
    request: IDBRequest<T>,
): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);

        request.onerror = () => {
            reject(
                request.error ??
                new Error("Error accediendo a los datos locales"),
            );
        };
    });
}

function transactionDone(
    transaction: IDBTransaction,
): Promise<void> {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();

        transaction.onerror = () => {
            reject(
                transaction.error ??
                new Error("Error guardando los datos locales"),
            );
        };

        transaction.onabort = () => {
            reject(
                transaction.error ??
                new Error("La operación local fue cancelada"),
            );
        };
    });
}

function calculateGroupMetrics(
    group: StoredGroup,
    parcels: ParcelFeature[],
): ParcelGroup {
    const groupParcels = parcels.filter(
        (parcel) =>
            !parcel.properties.is_deleted &&
            parcel.properties.group_id === group.id,
    );

    const areaM2 = groupParcels.reduce(
        (total, parcel) =>
            total + (parcel.properties.area_m2 ?? 0),
        0,
    );

    /*
     * For guest mode we currently sum parcel perimeters.
     *
     * The backend uses PostGIS to calculate the perimeter of the
     * union of the geometries, which avoids counting shared internal
     * borders. We can improve the local calculation later.
     */
    const perimeterM = groupParcels.reduce(
        (total, parcel) =>
            total + (parcel.properties.perimeter_m ?? 0),
        0,
    );

    return {
        id: group.id,
        name: group.name,
        is_hidden: group.is_hidden,
        parcel_count: groupParcels.length,
        area_m2: areaM2,
        area_ha: areaM2 / 10_000,
        perimeter_m: perimeterM,
    };
}

export const guestDb = {
    async listParcels(
        includeDeleted = false,
    ): Promise<ParcelFeature[]> {
        const db = await openDatabase();

        try {
            const transaction = db.transaction(
                PARCEL_STORE,
                "readonly",
            );

            const store = transaction.objectStore(
                PARCEL_STORE,
            );

            const rows = await requestResult<StoredParcel[]>(
                store.getAll(),
            );

            return rows
                .map((row) => row.feature)
                .filter(
                    (parcel) =>
                        includeDeleted ||
                        !parcel.properties.is_deleted,
                );
        } finally {
            db.close();
        }
    },

    async getParcel(
        cadastralRef: string,
    ): Promise<ParcelFeature | null> {
        const db = await openDatabase();

        try {
            const transaction = db.transaction(
                PARCEL_STORE,
                "readonly",
            );

            const store = transaction.objectStore(
                PARCEL_STORE,
            );

            const row = await requestResult<
                StoredParcel | undefined
            >(
                store.get(cadastralRef),
            );

            return row?.feature ?? null;
        } finally {
            db.close();
        }
    },

    async saveParcel(
        parcel: ParcelFeature,
    ): Promise<void> {
        const db = await openDatabase();

        try {
            const transaction = db.transaction(
                PARCEL_STORE,
                "readwrite",
            );

            const store = transaction.objectStore(
                PARCEL_STORE,
            );

            const cadastralRef =
                parcel.properties.cadastral_ref;

            const existing = await requestResult<
                StoredParcel | undefined
            >(
                store.get(cadastralRef),
            );

            const now = new Date().toISOString();

            store.put({
                cadastral_ref: cadastralRef,
                feature: parcel,
                created_at: existing?.created_at ?? now,
                updated_at: now,
            } satisfies StoredParcel);

            await transactionDone(transaction);
        } finally {
            db.close();
        }
    },

    async updateParcel(
        cadastralRef: string,
        update: Partial<ParcelFeature["properties"]>,
    ): Promise<void> {
        const db = await openDatabase();

        try {
            const transaction = db.transaction(
                PARCEL_STORE,
                "readwrite",
            );

            const store = transaction.objectStore(
                PARCEL_STORE,
            );

            const existing = await requestResult<
                StoredParcel | undefined
            >(
                store.get(cadastralRef),
            );

            if (!existing) {
                throw new Error(
                    "La parcela no existe en los datos locales",
                );
            }

            const updatedFeature: ParcelFeature = {
                ...existing.feature,
                properties: {
                    ...existing.feature.properties,
                    ...update,
                },
            };

            store.put({
                ...existing,
                feature: updatedFeature,
                updated_at: new Date().toISOString(),
            } satisfies StoredParcel);

            await transactionDone(transaction);
        } finally {
            db.close();
        }
    },

    async deleteParcel(
        cadastralRef: string,
    ): Promise<void> {
        await this.updateParcel(
            cadastralRef,
            {
                is_deleted: true,
            },
        );
    },

    async listGroups(): Promise<ParcelGroup[]> {
        const db = await openDatabase();

        try {
            const transaction = db.transaction(
                [
                    GROUP_STORE,
                    PARCEL_STORE,
                ],
                "readonly",
            );

            const groupRows =
                await requestResult<StoredGroup[]>(
                    transaction
                        .objectStore(GROUP_STORE)
                        .getAll(),
                );

            const parcelRows =
                await requestResult<StoredParcel[]>(
                    transaction
                        .objectStore(PARCEL_STORE)
                        .getAll(),
                );

            const parcels = parcelRows.map(
                (row) => row.feature,
            );

            return groupRows
                .map((group) =>
                    calculateGroupMetrics(
                        group,
                        parcels,
                    ),
                )
                .sort((a, b) =>
                    a.name.localeCompare(
                        b.name,
                        "es",
                    ),
                );
        } finally {
            db.close();
        }
    },

    async createGroup(
        name: string,
    ): Promise<ParcelGroup> {
        const cleaned = name.trim();

        if (!cleaned) {
            throw new Error(
                "El nombre del grupo no puede estar vacío",
            );
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        const group: StoredGroup = {
            id,
            name: cleaned,
            is_hidden: false,
            created_at: now,
            updated_at: now,
        };

        const db = await openDatabase();

        try {
            const transaction = db.transaction(
                GROUP_STORE,
                "readwrite",
            );

            transaction
                .objectStore(GROUP_STORE)
                .add(group);

            await transactionDone(transaction);
        } finally {
            db.close();
        }

        return {
            id,
            name: cleaned,
            is_hidden: false,
            parcel_count: 0,
            area_m2: 0,
            area_ha: 0,
            perimeter_m: 0,
        };
    },

    async updateGroup(
        groupId: string,
        update: {
            name?: string;
            is_hidden?: boolean;
        },
    ): Promise<void> {
        const db = await openDatabase();

        try {
            const transaction = db.transaction(
                GROUP_STORE,
                "readwrite",
            );

            const store = transaction.objectStore(
                GROUP_STORE,
            );

            const existing = await requestResult<
                StoredGroup | undefined
            >(
                store.get(groupId),
            );

            if (!existing) {
                throw new Error(
                    "El grupo no existe en los datos locales",
                );
            }

            store.put({
                ...existing,
                ...update,
                name:
                    update.name !== undefined
                        ? update.name.trim()
                        : existing.name,
                updated_at: new Date().toISOString(),
            });

            await transactionDone(transaction);
        } finally {
            db.close();
        }
    },

    async deleteGroup(
        groupId: string,
    ): Promise<void> {
        const db = await openDatabase();

        try {
            const transaction = db.transaction(
                [
                    GROUP_STORE,
                    PARCEL_STORE,
                ],
                "readwrite",
            );

            transaction
                .objectStore(GROUP_STORE)
                .delete(groupId);

            const parcelStore =
                transaction.objectStore(PARCEL_STORE);

            const parcels =
                await requestResult<StoredParcel[]>(
                    parcelStore.getAll(),
                );

            const now = new Date().toISOString();

            for (const parcel of parcels) {
                if (
                    parcel.feature.properties.group_id !==
                    groupId
                ) {
                    continue;
                }

                parcelStore.put({
                    ...parcel,
                    feature: {
                        ...parcel.feature,
                        properties: {
                            ...parcel.feature.properties,
                            group_id: null,
                        },
                    },
                    updated_at: now,
                } satisfies StoredParcel);
            }

            await transactionDone(transaction);
        } finally {
            db.close();
        }
    },

    async exportBackup(): Promise<BackupDocument> {
        const db = await openDatabase();

        try {
            const transaction = db.transaction(
                [
                    GROUP_STORE,
                    PARCEL_STORE,
                ],
                "readonly",
            );

            const groupRows =
                await requestResult<StoredGroup[]>(
                    transaction
                        .objectStore(GROUP_STORE)
                        .getAll(),
                );

            const parcelRows =
                await requestResult<StoredParcel[]>(
                    transaction
                        .objectStore(PARCEL_STORE)
                        .getAll(),
                );

            return {
                format: "catastro-digital-backup",
                version: 3,
                exported_at: new Date().toISOString(),

                groups: groupRows.map((group) => ({
                    id: group.id,
                    name: group.name,
                    is_hidden: group.is_hidden,
                    created_at: group.created_at,
                    updated_at: group.updated_at,
                })),

                parcels: parcelRows.map((row) => {
                    const parcel = row.feature;
                    const properties = parcel.properties;

                    return {
                        cadastral_ref:
                        properties.cadastral_ref,

                        name:
                            properties.name ?? null,

                        notes:
                            properties.notes ?? null,

                        color:
                            properties.color ??
                            DEFAULT_PARCEL_COLOR,

                        group_id:
                            properties.group_id ?? null,

                        is_deleted:
                        properties.is_deleted,

                        geometry:
                        parcel.geometry,

                        created_at:
                        row.created_at,

                        updated_at:
                        row.updated_at,

                        last_fetched_at:
                            null,

                        deleted_at:
                            properties.is_deleted
                                ? row.updated_at
                                : null,
                    };
                }),
            };
        } finally {
            db.close();
        }
    },

    async clear(): Promise<void> {
        const db = await openDatabase();

        try {
            const transaction = db.transaction(
                [
                    GROUP_STORE,
                    PARCEL_STORE,
                ],
                "readwrite",
            );

            transaction
                .objectStore(GROUP_STORE)
                .clear();

            transaction
                .objectStore(PARCEL_STORE)
                .clear();

            await transactionDone(transaction);
        } finally {
            db.close();
        }
    },

    async hasData(): Promise<boolean> {
        const db = await openDatabase();

        try {
            const transaction = db.transaction(
                [
                    GROUP_STORE,
                    PARCEL_STORE,
                ],
                "readonly",
            );

            const groups = await requestResult<number>(
                transaction
                    .objectStore(GROUP_STORE)
                    .count(),
            );

            const parcels = await requestResult<number>(
                transaction
                    .objectStore(PARCEL_STORE)
                    .count(),
            );

            return groups > 0 || parcels > 0;
        } finally {
            db.close();
        }
    },
};