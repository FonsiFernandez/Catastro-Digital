"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  cadastreApi,
  readableApiError,
} from "@/lib/api";
import { guestDb } from "@/lib/guestDb";

import type {
  CadastralUnit,
  FieldTarget,
  GroupUpdate,
  NoticeState,
  ParcelFeature,
  ParcelGroup,
  ParcelUpdate,
} from "@/types/cadastre";


const FIELD_SEARCH_RADIUS_M = 500;

type LonLat = [number, number];

function toLocalMeters(point: LonLat, origin: LonLat): LonLat {
  const latRad = (origin[1] * Math.PI) / 180;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLon = 111_320 * Math.cos(latRad);

  return [
    (point[0] - origin[0]) * metersPerDegreeLon,
    (point[1] - origin[1]) * metersPerDegreeLat,
  ];
}

function fromLocalMeters(point: LonLat, origin: LonLat): LonLat {
  const latRad = (origin[1] * Math.PI) / 180;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLon = 111_320 * Math.cos(latRad);

  return [
    origin[0] + point[0] / metersPerDegreeLon,
    origin[1] + point[1] / metersPerDegreeLat,
  ];
}

function pointInRing(point: LonLat, ring: LonLat[]): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersects =
        yi > point[1] !== yj > point[1] &&
        point[0] <
        ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function pointInPolygon(point: LonLat, rings: LonLat[][]): boolean {
  if (!rings.length || !pointInRing(point, rings[0])) return false;

  for (let i = 1; i < rings.length; i += 1) {
    if (pointInRing(point, rings[i])) return false;
  }

  return true;
}

function nearestPointOnSegment(
    point: LonLat,
    start: LonLat,
    end: LonLat,
): { point: LonLat; distance: number } {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];

  if (dx === 0 && dy === 0) {
    return {
      point: start,
      distance: Math.hypot(point[0] - start[0], point[1] - start[1]),
    };
  }

  const t = Math.max(
      0,
      Math.min(
          1,
          ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
          (dx * dx + dy * dy),
      ),
  );

  const projected: LonLat = [
    start[0] + t * dx,
    start[1] + t * dy,
  ];

  return {
    point: projected,
    distance: Math.hypot(
        point[0] - projected[0],
        point[1] - projected[1],
    ),
  };
}

function analyseParcelAtPosition(
    parcel: ParcelFeature,
    longitude: number,
    latitude: number,
): {
  inside: boolean;
  boundaryDistanceM: number;
  nearestBoundary: LonLat;
} | null {
  const geometry = parcel.geometry;

  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
    return null;
  }

  const position: LonLat = [longitude, latitude];

  const polygons =
      geometry.type === "Polygon"
          ? [geometry.coordinates]
          : geometry.coordinates;

  let inside = false;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestPoint: LonLat | null = null;

  for (const polygon of polygons) {
    const rings = polygon as LonLat[][];

    if (pointInPolygon(position, rings)) {
      inside = true;
    }

    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i += 1) {
        const start = toLocalMeters(ring[i], position);
        const end = toLocalMeters(ring[i + 1], position);

        const nearest = nearestPointOnSegment([0, 0], start, end);

        if (nearest.distance < bestDistance) {
          bestDistance = nearest.distance;
          bestPoint = fromLocalMeters(nearest.point, position);
        }
      }
    }
  }

  if (!bestPoint) return null;

  return {
    inside,
    boundaryDistanceM: bestDistance,
    nearestBoundary: bestPoint,
  };
}

export function useCadastreData(
    includeDeleted: boolean,
    authenticated: boolean,
) {
  const [groups, setGroups] = useState<ParcelGroup[]>([]);
  const [parcels, setParcels] = useState<ParcelFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<NoticeState>(null);
  const refreshRequestIdRef = useRef(0);

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
    const requestId =
        ++refreshRequestIdRef.current;

    const refreshForCurrentSession =
        async () => {
          setLoading(true);

          try {
            const [
              nextGroups,
              nextParcels,
            ] = await Promise.all([
              authenticated
                  ? cadastreApi.groups.list()
                  : guestDb.listGroups(),

              authenticated
                  ? cadastreApi.parcels
                      .list(includeDeleted)
                      .then(
                          (collection) =>
                              collection.features,
                      )
                  : guestDb.listParcels(
                      includeDeleted,
                  ),
            ]);

            /*
             * Ignore results from an older
             * guest/account session.
             */
            if (
                refreshRequestIdRef.current !==
                requestId
            ) {
              return;
            }

            setGroups(nextGroups);
            setParcels(nextParcels);
          } catch (error) {
            if (
                refreshRequestIdRef.current !==
                requestId
            ) {
              return;
            }

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
            if (
                refreshRequestIdRef.current ===
                requestId
            ) {
              setLoading(false);
            }
          }
        };

    void refreshForCurrentSession();

    return () => {
      /*
       * Invalidate this request if the
       * authentication context changes.
       */
      if (
          refreshRequestIdRef.current ===
          requestId
      ) {
        refreshRequestIdRef.current += 1;
      }
    };
  }, [
    authenticated,
    includeDeleted,
  ]);

  // -----------------------------------------------------------------------
  // Identify parcel from map point
  // -----------------------------------------------------------------------

  const identifyParcel = useCallback(
      async (
          longitude: number,
          latitude: number,
      ) => {
        const baseResult = authenticated
            ? await cadastreApi.parcels.identify(longitude, latitude)
            : await cadastreApi.parcels.previewIdentify(longitude, latitude);

        const cadastralRef = baseResult.parcel.properties.cadastral_ref;
        let units: CadastralUnit[] = [];

        try {
          units = (await cadastreApi.parcels.units(cadastralRef)).units;
        } catch (error) {
          console.warn("No se pudieron cargar los inmuebles asociados:", error);
        }

        let alreadySaved = baseResult.already_saved;
        let selectedUnitRefs: string[] = [];

        if (authenticated) {
          if (alreadySaved && units.length > 0) {
            try {
              const selected = await cadastreApi.parcels.selectedUnits(cadastralRef);
              selectedUnitRefs = selected.units.map((unit) => unit.cadastral_ref);
            } catch (error) {
              console.warn("No se pudo cargar la selección de inmuebles:", error);
            }
          }
        } else {
          const rc14 = cadastralRef.replace(/\s+/g, "").toUpperCase().slice(0, 14);
          const localParcels = await guestDb.listParcels(true);
          alreadySaved = localParcels.some(
              (parcel) => parcel.properties.cadastral_ref
                  .replace(/\s+/g, "")
                  .toUpperCase()
                  .slice(0, 14) === rc14,
          );

          if (alreadySaved && units.length > 0) {
            selectedUnitRefs = (await guestDb.listUnits(cadastralRef))
                .map((unit) => unit.cadastral_ref);
          }
        }

        if (units.length > 0 && selectedUnitRefs.length === 0) {
          selectedUnitRefs = units.map((unit) => unit.cadastral_ref);
        }

        return {
          ...baseResult,
          already_saved: alreadySaved,
          units,
          selected_unit_refs: selectedUnitRefs,
        };
      },
      [authenticated],
  );

  // -----------------------------------------------------------------------
  // Field mode
  //
  // Authenticated users use the backend/PostGIS.
  // Guests calculate the same result locally against IndexedDB parcels.
  // -----------------------------------------------------------------------

  const fieldPosition = useCallback(
      async (
          longitude: number,
          latitude: number,
          selectedRef?: string | null,
      ) => {
        if (authenticated) {
          return cadastreApi.parcels.fieldPosition(
              longitude,
              latitude,
              selectedRef,
          );
        }

        const activeParcels = await guestDb.listParcels(false);
        let candidates = activeParcels;

        if (selectedRef) {
          const normalised = selectedRef.replace(/\s+/g, "").toUpperCase();
          const rc14 = normalised.slice(0, 14);

          candidates = activeParcels.filter((parcel) => {
            const parcelRef = parcel.properties.cadastral_ref
                .replace(/\s+/g, "")
                .toUpperCase();

            return (
                parcelRef === normalised ||
                (normalised.length === 14 &&
                    parcelRef.slice(0, 14) === rc14)
            );
          });
        }

        let best:
            | {
          parcel: ParcelFeature;
          analysis: NonNullable<
              ReturnType<typeof analyseParcelAtPosition>
          >;
        }
            | null = null;

        for (const parcel of candidates) {
          const analysis = analyseParcelAtPosition(
              parcel,
              longitude,
              latitude,
          );

          if (!analysis) continue;

          if (selectedRef) {
            best = { parcel, analysis };
            break;
          }

          if (
              !analysis.inside &&
              analysis.boundaryDistanceM > FIELD_SEARCH_RADIUS_M
          ) {
            continue;
          }

          if (!best) {
            best = { parcel, analysis };
            continue;
          }

          if (analysis.inside && !best.analysis.inside) {
            best = { parcel, analysis };
            continue;
          }

          if (
              analysis.inside === best.analysis.inside &&
              analysis.boundaryDistanceM <
              best.analysis.boundaryDistanceM
          ) {
            best = { parcel, analysis };
          }
        }

        if (!best) {
          return {
            target: null,
            search_radius_m: FIELD_SEARCH_RADIUS_M,
          };
        }

        const groupName = best.parcel.properties.group_id
            ? groups.find(
            (group) =>
                group.id === best!.parcel.properties.group_id,
        )?.name ?? null
            : null;

        const target: FieldTarget = {
          parcel: best.parcel,
          group_name: groupName,
          inside: best.analysis.inside,
          boundary_distance_m: best.analysis.boundaryDistanceM,
          nearest_boundary: {
            type: "Point",
            coordinates: best.analysis.nearestBoundary,
          },
        };

        return {
          target,
          search_radius_m: FIELD_SEARCH_RADIUS_M,
        };
      },
      [authenticated, groups],
  );

  // -----------------------------------------------------------------------
  // Lookup parcel by cadastral reference
  // -----------------------------------------------------------------------

  const lookupParcel = useCallback(
      async (
          cadastralRef: string,
      ) => {
        let parcel: ParcelFeature;

        if (authenticated) {
          parcel =
              await cadastreApi.parcels.lookup(
                  cadastralRef,
              );
        } else {
          parcel =
              await cadastreApi.parcels.preview(
                  cadastralRef,
              );

          await guestDb.saveParcel(parcel);
        }

        await Promise.all([
          refreshParcels(),
          refreshGroups(),
        ]);

        setNotice({
          type: "success",
          message: authenticated
              ? "Parcela cargada correctamente"
              : "Parcela guardada en este navegador",
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
  // Save a parcel that came from map preview
  // -----------------------------------------------------------------------

  const savePreviewParcel = useCallback(
      async (
          parcel: ParcelFeature,
          units: CadastralUnit[] = [],
          selectedUnitRefs: string[] = [],
      ) => {
        const selectedUnits = units.filter(
            (unit) => selectedUnitRefs.includes(unit.cadastral_ref),
        );

        if (units.length > 0 && selectedUnits.length === 0) {
          throw new Error("Selecciona al menos un inmueble antes de guardar");
        }

        if (authenticated) {
          const saved = await lookupParcel(parcel.properties.cadastral_ref);
          if (selectedUnits.length > 0) {
            await cadastreApi.parcels.saveUnitSelection(
                parcel.properties.cadastral_ref,
                selectedUnits,
            );
          }
          return saved;
        }

        await guestDb.saveParcel(parcel);
        if (selectedUnits.length > 0) {
          await guestDb.replaceUnits(parcel.properties.cadastral_ref, selectedUnits);
        }

        await Promise.all([refreshParcels(), refreshGroups()]);
        setNotice({
          type: "success",
          message: selectedUnits.length > 0
              ? "Parcela e inmuebles guardados en este navegador"
              : "Parcela guardada en este navegador",
        });
        return parcel;
      },
      [authenticated, lookupParcel, refreshParcels, refreshGroups],
  );

  const saveParcelUnits = useCallback(
      async (
          cadastralRef: string,
          units: CadastralUnit[],
          selectedUnitRefs: string[],
      ) => {
        if (units.length === 0) return;

        const selectedUnits = units.filter(
            (unit) => selectedUnitRefs.includes(unit.cadastral_ref),
        );

        if (selectedUnits.length === 0) {
          throw new Error("Selecciona al menos un inmueble antes de guardar");
        }

        if (authenticated) {
          await cadastreApi.parcels.saveUnitSelection(cadastralRef, selectedUnits);
        } else {
          await guestDb.replaceUnits(cadastralRef, selectedUnits);
        }
      },
      [authenticated],
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
    savePreviewParcel,
    saveParcelUnits,

    updateParcel,
    deleteParcel,

    createGroup,
    updateGroup,
    deleteGroup,
  };
}
