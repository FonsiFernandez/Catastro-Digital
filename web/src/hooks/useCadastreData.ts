"use client";

import { useCallback, useEffect, useState } from "react";

import {
  cadastreApi,
  readableApiError,
} from "@/lib/api";

import { guestDb } from "@/lib/guestDb";

import type {
  GroupUpdate,
  NoticeState,
  ParcelFeature,
  ParcelGroup,
  ParcelUpdate,
} from "@/types/cadastre";


export function useCadastreData(
    includeDeleted: boolean,
    authenticated: boolean,
) {
  const [groups, setGroups] = useState<ParcelGroup[]>([]);
  const [parcels, setParcels] = useState<ParcelFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState>(null);

  const clearNotice = useCallback(
      () => setNotice(null),
      [],
  );


  // -----------------------------------------------------------------------
  // Refresh groups
  // -----------------------------------------------------------------------

  const refreshGroups = useCallback(async () => {
    const nextGroups = authenticated
        ? await cadastreApi.groups.list()
        : await guestDb.listGroups();

    setGroups(nextGroups);

    return nextGroups;
  }, [authenticated]);


  // -----------------------------------------------------------------------
  // Refresh parcels
  // -----------------------------------------------------------------------

  const refreshParcels = useCallback(
      async (deleted = includeDeleted) => {
        if (authenticated) {
          const collection =
              await cadastreApi.parcels.list(deleted);

          setParcels(collection.features);

          return collection.features;
        }

        const nextParcels =
            await guestDb.listParcels(deleted);

        setParcels(nextParcels);

        return nextParcels;
      },
      [
        authenticated,
        includeDeleted,
      ],
  );


  // -----------------------------------------------------------------------
  // Refresh everything
  // -----------------------------------------------------------------------

  const refreshAll = useCallback(async () => {
    setLoading(true);

    try {
      await Promise.all([
        refreshGroups(),
        refreshParcels(),
      ]);
    } catch (error) {
      setNotice({
        type: "error",
        message: readableApiError(
            error,
            authenticated
                ? "No se pudieron cargar los datos"
                : "No se pudieron cargar los datos locales",
        ),
      });
    } finally {
      setLoading(false);
    }
  }, [
    authenticated,
    refreshGroups,
    refreshParcels,
  ]);


  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);


  // -----------------------------------------------------------------------
  // Identify
  //
  // Authenticated mode works already.
  // Guest preview will be connected to a public backend endpoint next.
  // -----------------------------------------------------------------------

  const identifyParcel = useCallback(
      async (
          longitude: number,
          latitude: number,
      ) => {
        if (!authenticated) {
          throw new Error(
              "La selección de parcelas desde el mapa para invitados estará disponible en el siguiente paso.",
          );
        }

        return cadastreApi.parcels.identify(
            longitude,
            latitude,
        );
      },
      [authenticated],
  );


  // -----------------------------------------------------------------------
  // Field mode
  //
  // For the moment field calculations continue using the authenticated
  // backend. Local geometric field calculations will be added separately.
  // -----------------------------------------------------------------------

  const fieldPosition = useCallback(
      async (
          longitude: number,
          latitude: number,
          selectedRef?: string | null,
      ) => {
        if (!authenticated) {
          throw new Error(
              "El modo campo requiere iniciar sesión por ahora.",
          );
        }

        return cadastreApi.parcels.fieldPosition(
            longitude,
            latitude,
            selectedRef,
        );
      },
      [authenticated],
  );


  // -----------------------------------------------------------------------
  // Lookup
  // -----------------------------------------------------------------------

  const lookupParcel = useCallback(
      async (
          cadastralRef: string,
      ) => {
        if (!authenticated) {
          throw new Error(
              "La búsqueda catastral para invitados estará disponible en el siguiente paso.",
          );
        }

        const parcel =
            await cadastreApi.parcels.lookup(
                cadastralRef,
            );

        await Promise.all([
          refreshParcels(),
          refreshGroups(),
        ]);

        setNotice({
          type: "success",
          message: "Parcela cargada correctamente",
        });

        return parcel;
      },
      [
        authenticated,
        refreshGroups,
        refreshParcels,
      ],
  );


  // -----------------------------------------------------------------------
  // Update parcel
  // -----------------------------------------------------------------------

  const updateParcel = useCallback(
      async (
          cadastralRef: string,
          update: ParcelUpdate,
      ) => {
        setParcels((current) =>
            current.map((feature) =>
                feature.properties.cadastral_ref === cadastralRef
                    ? {
                      ...feature,
                      properties: {
                        ...feature.properties,
                        ...update,
                      },
                    }
                    : feature,
            ),
        );

        try {
          if (authenticated) {
            await cadastreApi.parcels.update(
                cadastralRef,
                update,
            );
          } else {
            await guestDb.updateParcel(
                cadastralRef,
                update,
            );
          }

          if (
              "group_id" in update ||
              "is_deleted" in update
          ) {
            await Promise.all([
              refreshParcels(),
              refreshGroups(),
            ]);
          } else {
            await refreshParcels();
          }
        } catch (error) {
          await refreshParcels();

          setNotice({
            type: "error",
            message: readableApiError(
                error,
                "No se pudo guardar la parcela",
            ),
          });

          throw error;
        }
      },
      [
        authenticated,
        refreshGroups,
        refreshParcels,
      ],
  );


  // -----------------------------------------------------------------------
  // Delete parcel
  // -----------------------------------------------------------------------

  const deleteParcel = useCallback(
      async (
          cadastralRef: string,
      ) => {
        try {
          if (authenticated) {
            await cadastreApi.parcels.delete(
                cadastralRef,
            );
          } else {
            await guestDb.deleteParcel(
                cadastralRef,
            );
          }

          await Promise.all([
            refreshParcels(),
            refreshGroups(),
          ]);

          setNotice({
            type: "success",
            message: "Parcela movida a borradas",
          });
        } catch (error) {
          setNotice({
            type: "error",
            message: readableApiError(
                error,
                "No se pudo borrar la parcela",
            ),
          });

          throw error;
        }
      },
      [
        authenticated,
        refreshGroups,
        refreshParcels,
      ],
  );


  // -----------------------------------------------------------------------
  // Create group
  // -----------------------------------------------------------------------

  const createGroup = useCallback(
      async (
          name: string,
      ) => {
        try {
          const group = authenticated
              ? await cadastreApi.groups.create(name)
              : await guestDb.createGroup(name);

          await refreshGroups();

          setNotice({
            type: "success",
            message: `Grupo “${group.name}” creado`,
          });

          return group;
        } catch (error) {
          setNotice({
            type: "error",
            message: readableApiError(
                error,
                "No se pudo crear el grupo",
            ),
          });

          throw error;
        }
      },
      [
        authenticated,
        refreshGroups,
      ],
  );


  // -----------------------------------------------------------------------
  // Update group
  // -----------------------------------------------------------------------

  const updateGroup = useCallback(
      async (
          groupId: string,
          update: GroupUpdate,
      ) => {
        setGroups((current) =>
            current.map((group) =>
                group.id === groupId
                    ? {
                      ...group,
                      ...update,
                    }
                    : group,
            ),
        );

        try {
          if (authenticated) {
            await cadastreApi.groups.update(
                groupId,
                update,
            );
          } else {
            await guestDb.updateGroup(
                groupId,
                update,
            );
          }

          await refreshGroups();
        } catch (error) {
          await refreshGroups();

          setNotice({
            type: "error",
            message: readableApiError(
                error,
                "No se pudo actualizar el grupo",
            ),
          });

          throw error;
        }
      },
      [
        authenticated,
        refreshGroups,
      ],
  );


  // -----------------------------------------------------------------------
  // Delete group
  // -----------------------------------------------------------------------

  const deleteGroup = useCallback(
      async (
          groupId: string,
      ) => {
        try {
          if (authenticated) {
            await cadastreApi.groups.delete(
                groupId,
            );
          } else {
            await guestDb.deleteGroup(
                groupId,
            );
          }

          await Promise.all([
            refreshGroups(),
            refreshParcels(),
          ]);

          setNotice({
            type: "success",
            message:
                "Grupo eliminado; sus parcelas quedan sin grupo",
          });
        } catch (error) {
          setNotice({
            type: "error",
            message: readableApiError(
                error,
                "No se pudo eliminar el grupo",
            ),
          });

          throw error;
        }
      },
      [
        authenticated,
        refreshGroups,
        refreshParcels,
      ],
  );


  return {
    groups,
    parcels,
    loading,
    notice,

    setNotice,
    clearNotice,

    refreshAll,

    identifyParcel,
    fieldPosition,
    lookupParcel,

    updateParcel,
    deleteParcel,

    createGroup,
    updateGroup,
    deleteGroup,
  };
}