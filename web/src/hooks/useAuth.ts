"use client";

import {
    useCallback,
    useEffect,
    useState,
} from "react";

import {
    cadastreApi,
    clearAuthToken,
    getAuthToken,
    setAuthToken,
    type AuthUser,
} from "@/lib/api";

import { guestDb } from "@/lib/guestDb";

export type AuthStatus =
    | "loading"
    | "guest"
    | "authenticated";

export type GuestGroupConflict = {
    guestGroupId: string;
    guestGroupName: string;
    existingGroupId: string;
    existingGroupName: string;
};

export type GuestMigrationPreview = {
    guestGroups: number;
    guestParcels: number;
    conflicts: GuestGroupConflict[];
};

export type GuestGroupResolution =
    | {
    action: "existing";
}
    | {
    action: "rename";
    newName: string;
};

export type GuestMigrationResolutions =
    Record<string, GuestGroupResolution>;

function normaliseGroupName(name: string): string {
    return name
        .trim()
        .toLocaleLowerCase("es");
}

export function useAuth() {
    const [status, setStatus] =
        useState<AuthStatus>("loading");

    const [user, setUser] =
        useState<AuthUser | null>(null);

    const [hasGuestData, setHasGuestData] =
        useState(false);

    const refreshGuestDataState =
        useCallback(async () => {
            try {
                const hasData =
                    await guestDb.hasData();

                setHasGuestData(hasData);
            } catch {
                setHasGuestData(false);
            }
        }, []);

    useEffect(() => {
        void refreshGuestDataState();

        const token = getAuthToken();

        if (!token) {
            setUser(null);
            setStatus("guest");
            return;
        }

        void cadastreApi.auth
            .me()
            .then(async (currentUser) => {
                setUser(currentUser);
                setStatus("authenticated");

                await refreshGuestDataState();
            })
            .catch(() => {
                clearAuthToken();
                setUser(null);
                setStatus("guest");
            });
    }, [refreshGuestDataState]);

    const login = useCallback(
        async (
            email: string,
            password: string,
        ) => {
            const response =
                await cadastreApi.auth.login(
                    email.trim(),
                    password,
                );

            setAuthToken(
                response.access_token,
            );

            setUser(
                response.user,
            );

            setStatus(
                "authenticated",
            );

            await refreshGuestDataState();

            return response.user;
        },
        [refreshGuestDataState],
    );

    const register = useCallback(
        async (
            email: string,
            password: string,
            displayName?: string,
        ) => {
            const response =
                await cadastreApi.auth.register(
                    email.trim(),
                    password,
                    displayName,
                );

            setAuthToken(
                response.access_token,
            );

            setUser(
                response.user,
            );

            setStatus(
                "authenticated",
            );

            await refreshGuestDataState();

            return response.user;
        },
        [refreshGuestDataState],
    );

    const getGuestMigrationPreview =
        useCallback(async (): Promise<GuestMigrationPreview> => {
            const backup =
                await guestDb.exportBackup();

            const accountGroups =
                await cadastreApi.groups.list();

            const accountGroupsByName =
                new Map(
                    accountGroups.map((group) => [
                        normaliseGroupName(group.name),
                        group,
                    ]),
                );

            const conflicts: GuestGroupConflict[] = [];

            for (const guestGroup of backup.groups) {
                const existingGroup =
                    accountGroupsByName.get(
                        normaliseGroupName(
                            guestGroup.name,
                        ),
                    );

                if (!existingGroup) {
                    continue;
                }

                conflicts.push({
                    guestGroupId:
                    guestGroup.id,

                    guestGroupName:
                    guestGroup.name,

                    existingGroupId:
                    existingGroup.id,

                    existingGroupName:
                    existingGroup.name,
                });
            }

            return {
                guestGroups:
                backup.groups.length,

                guestParcels:
                backup.parcels.length,

                conflicts,
            };
        }, []);

    const migrateGuestData =
        useCallback(
            async (
                resolutions: GuestMigrationResolutions = {},
            ) => {
                const hasData =
                    await guestDb.hasData();

                if (!hasData) {
                    setHasGuestData(false);

                    return {
                        migrated: false,
                        groups: 0,
                        parcels: 0,
                    };
                }

                const backup =
                    await guestDb.exportBackup();

                const accountGroups =
                    await cadastreApi.groups.list();

                const accountGroupsByName =
                    new Map(
                        accountGroups.map((group) => [
                            normaliseGroupName(group.name),
                            group,
                        ]),
                    );

                /*
                 * Maps a guest group ID to the final account group ID
                 * when the user chooses to merge it into an existing group.
                 */
                const groupIdRemap =
                    new Map<string, string>();

                /*
                 * Names that will exist once migration completes.
                 *
                 * Start with all account group names.
                 */
                const usedNames =
                    new Set(
                        accountGroups.map((group) =>
                            normaliseGroupName(
                                group.name,
                            ),
                        ),
                    );

                /*
                 * First reserve the names of guest groups that do not
                 * currently conflict with the account.
                 */
                for (const guestGroup of backup.groups) {
                    const normalised =
                        normaliseGroupName(
                            guestGroup.name,
                        );

                    if (
                        !accountGroupsByName.has(
                            normalised,
                        )
                    ) {
                        usedNames.add(
                            normalised,
                        );
                    }
                }

                const finalGroups =
                    backup.groups.flatMap(
                        (guestGroup) => {
                            const normalisedName =
                                normaliseGroupName(
                                    guestGroup.name,
                                );

                            const existingGroup =
                                accountGroupsByName.get(
                                    normalisedName,
                                );

                            /*
                             * No conflict.
                             * Keep the guest group as-is.
                             */
                            if (!existingGroup) {
                                return [
                                    guestGroup,
                                ];
                            }

                            const resolution =
                                resolutions[
                                    guestGroup.id
                                    ];

                            if (!resolution) {
                                throw new Error(
                                    `Debes resolver el conflicto del grupo "${guestGroup.name}"`,
                                );
                            }

                            /*
                             * Merge the guest parcels into the
                             * existing account group.
                             */
                            if (
                                resolution.action ===
                                "existing"
                            ) {
                                groupIdRemap.set(
                                    guestGroup.id,
                                    existingGroup.id,
                                );

                                /*
                                 * Do not import the guest group itself.
                                 */
                                return [];
                            }

                            /*
                             * Create the guest group using a new name.
                             */
                            const newName =
                                resolution.newName.trim();

                            if (!newName) {
                                throw new Error(
                                    `El nuevo nombre para "${guestGroup.name}" no puede estar vacío`,
                                );
                            }

                            const normalisedNewName =
                                normaliseGroupName(
                                    newName,
                                );

                            if (
                                usedNames.has(
                                    normalisedNewName,
                                )
                            ) {
                                throw new Error(
                                    `Ya existe un grupo llamado "${newName}"`,
                                );
                            }

                            usedNames.add(
                                normalisedNewName,
                            );

                            return [
                                {
                                    ...guestGroup,
                                    name: newName,
                                    updated_at:
                                        new Date().toISOString(),
                                },
                            ];
                        },
                    );

                const finalParcels =
                    backup.parcels.map(
                        (parcel) => {
                            if (!parcel.group_id) {
                                return parcel;
                            }

                            const mappedGroupId =
                                groupIdRemap.get(
                                    parcel.group_id,
                                );

                            if (!mappedGroupId) {
                                return parcel;
                            }

                            return {
                                ...parcel,
                                group_id:
                                mappedGroupId,
                            };
                        },
                    );

                const migrationDocument = {
                    ...backup,
                    groups: finalGroups,
                    parcels: finalParcels,
                };

                /*
                 * Validate first.
                 *
                 * No server data is changed here.
                 */
                await cadastreApi.backup.validate(
                    migrationDocument,
                    "merge",
                );

                /*
                 * Perform the actual import only after validation succeeds.
                 */
                const result =
                    await cadastreApi.backup.import(
                        migrationDocument,
                        "merge",
                    );

                if (!result.ok) {
                    throw new Error(
                        "No se pudieron importar los datos locales",
                    );
                }

                /*
                 * Guest data is deleted only after the backend
                 * confirms a successful import.
                 */
                await guestDb.clear();

                setHasGuestData(false);

                return {
                    migrated: true,
                    groups: result.groups,
                    parcels: result.parcels,
                };
            },
            [],
        );

    const logout =
        useCallback(() => {
            cadastreApi.auth.logout();

            setUser(null);

            setStatus("guest");

            void refreshGuestDataState();
        }, [refreshGuestDataState]);

    return {
        status,
        user,

        isLoading:
            status === "loading",

        isGuest:
            status === "guest",

        isAuthenticated:
            status === "authenticated",

        hasGuestData,

        login,
        register,
        logout,

        migrateGuestData,
        getGuestMigrationPreview,
        refreshGuestDataState,
    };
}