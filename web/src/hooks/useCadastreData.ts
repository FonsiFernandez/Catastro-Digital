"use client";

import { useCallback, useEffect, useState } from "react";

import { cadastreApi, readableApiError } from "@/lib/api";
import type {
  GroupUpdate,
  NoticeState,
  ParcelFeature,
  ParcelGroup,
  ParcelUpdate,
} from "@/types/cadastre";

export function useCadastreData(includeDeleted: boolean) {
  const [groups, setGroups] = useState<ParcelGroup[]>([]);
  const [parcels, setParcels] = useState<ParcelFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState>(null);

  const clearNotice = useCallback(() => setNotice(null), []);

  const refreshGroups = useCallback(async () => {
    const nextGroups = await cadastreApi.groups.list();
    setGroups(nextGroups);
    return nextGroups;
  }, []);

  const refreshParcels = useCallback(async (deleted = includeDeleted) => {
    const collection = await cadastreApi.parcels.list(deleted);
    setParcels(collection.features);
    return collection.features;
  }, [includeDeleted]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([refreshGroups(), refreshParcels()]);
    } catch (error) {
      setNotice({
        type: "error",
        message: readableApiError(error, "No se pudieron cargar los datos"),
      });
    } finally {
      setLoading(false);
    }
  }, [refreshGroups, refreshParcels]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  const identifyParcel = useCallback(async (longitude: number, latitude: number) => {
    return cadastreApi.parcels.identify(longitude, latitude);
  }, []);

  const fieldPosition = useCallback(async (longitude: number, latitude: number, selectedRef?: string | null) => {
    return cadastreApi.parcels.fieldPosition(longitude, latitude, selectedRef);
  }, []);

  const lookupParcel = useCallback(async (cadastralRef: string) => {
    const parcel = await cadastreApi.parcels.lookup(cadastralRef);
    await Promise.all([refreshParcels(), refreshGroups()]);
    setNotice({ type: "success", message: "Parcela cargada correctamente" });
    return parcel;
  }, [refreshGroups, refreshParcels]);

  const updateParcel = useCallback(async (cadastralRef: string, update: ParcelUpdate) => {
    // Optimistic UI keeps the inspector responsive, then the server remains source of truth.
    setParcels((current) =>
      current.map((feature) =>
        feature.properties.cadastral_ref === cadastralRef
          ? {
              ...feature,
              properties: { ...feature.properties, ...update },
            }
          : feature,
      ),
    );

    try {
      await cadastreApi.parcels.update(cadastralRef, update);
      if ("group_id" in update || "is_deleted" in update) {
        await Promise.all([refreshParcels(), refreshGroups()]);
      } else {
        await refreshParcels();
      }
    } catch (error) {
      await refreshParcels();
      setNotice({
        type: "error",
        message: readableApiError(error, "No se pudo guardar la parcela"),
      });
      throw error;
    }
  }, [refreshGroups, refreshParcels]);

  const deleteParcel = useCallback(async (cadastralRef: string) => {
    try {
      await cadastreApi.parcels.delete(cadastralRef);
      await Promise.all([refreshParcels(), refreshGroups()]);
      setNotice({ type: "success", message: "Parcela movida a borradas" });
    } catch (error) {
      setNotice({
        type: "error",
        message: readableApiError(error, "No se pudo borrar la parcela"),
      });
      throw error;
    }
  }, [refreshGroups, refreshParcels]);

  const createGroup = useCallback(async (name: string) => {
    try {
      const group = await cadastreApi.groups.create(name);
      await refreshGroups();
      setNotice({ type: "success", message: `Grupo “${group.name}” creado` });
      return group;
    } catch (error) {
      setNotice({
        type: "error",
        message: readableApiError(error, "No se pudo crear el grupo"),
      });
      throw error;
    }
  }, [refreshGroups]);

  const updateGroup = useCallback(async (groupId: string, update: GroupUpdate) => {
    setGroups((current) =>
      current.map((group) => (group.id === groupId ? { ...group, ...update } : group)),
    );
    try {
      await cadastreApi.groups.update(groupId, update);
      await refreshGroups();
    } catch (error) {
      await refreshGroups();
      setNotice({
        type: "error",
        message: readableApiError(error, "No se pudo actualizar el grupo"),
      });
      throw error;
    }
  }, [refreshGroups]);

  const deleteGroup = useCallback(async (groupId: string) => {
    try {
      await cadastreApi.groups.delete(groupId);
      await Promise.all([refreshGroups(), refreshParcels()]);
      setNotice({ type: "success", message: "Grupo eliminado; sus parcelas quedan sin grupo" });
    } catch (error) {
      setNotice({
        type: "error",
        message: readableApiError(error, "No se pudo eliminar el grupo"),
      });
      throw error;
    }
  }, [refreshGroups, refreshParcels]);

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
