"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CadastreMap, type CadastreMapHandle } from "@/components/map/CadastreMap";
import { FieldModePanel } from "@/components/map/FieldModePanel";
import { ParcelPickerPanel } from "@/components/map/ParcelPickerPanel";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { CrosshairIcon } from "@/components/ui/Icons";
import { Notice } from "@/components/ui/Notice";
import { MobileWelcome } from "@/components/MobileWelcome";
import { useAuth } from "@/hooks/useAuth";
import { useCadastreData } from "@/hooks/useCadastreData";
import { useFieldLocation } from "@/hooks/useFieldLocation";
import { readableApiError } from "@/lib/api";
import { formatHectares } from "@/lib/format";
import type { BaseMapId, FieldTarget, ParcelFeature, CadastralUnit } from "@/types/cadastre";

const RC_RE = /^[0-9A-Z]{14,20}$/;
const BASE_MAPS: BaseMapId[] = ["street", "aerial", "topographic"];
const USE_MOCK_CADASTRE =
    process.env.NEXT_PUBLIC_USE_MOCK_CADASTRE === "true";

function useStoredBoolean(key: string, initialValue: boolean) {
  const [value, setValue] = useState(initialValue);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(key);
    if (stored !== null) setValue(stored === "true");
    setStorageReady(true);
  }, [key]);

  useEffect(() => {
    if (storageReady) window.localStorage.setItem(key, String(value));
  }, [key, storageReady, value]);

  return [value, setValue] as const;
}

function useStoredBaseMap(key: string, initialValue: BaseMapId) {
  const [value, setValue] = useState<BaseMapId>(initialValue);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(key) as BaseMapId | null;
    if (stored && BASE_MAPS.includes(stored)) setValue(stored);
    setStorageReady(true);
  }, [key]);

  useEffect(() => {
    if (storageReady) window.localStorage.setItem(key, value);
  }, [key, storageReady, value]);

  return [value, setValue] as const;
}

export default function CadastreApp() {
  const mapRef = useRef<CadastreMapHandle | null>(null);
  const identifyRequestIdRef = useRef(0);
  const fieldRequestIdRef = useRef(0);
  const centeredFirstFieldFixRef = useRef(false);
  const fieldBaseMapRef = useRef<BaseMapId | null>(null);
  const fieldShowCatastroRef = useRef<boolean | null>(null);

  const [rcInput, setRcInput] = useState("");
  const [selectedRc, setSelectedRc] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [baseMap, setBaseMap] = useStoredBaseMap("catastro.baseMap", "street");
  const [showCatastro, setShowCatastro] = useStoredBoolean("catastro.showLayer", false);
  const [includeDeleted, setIncludeDeleted] = useStoredBoolean("catastro.includeDeleted", false);

  const [identifyLoading, setIdentifyLoading] = useState(false);
  const [savingPreview, setSavingPreview] = useState(false);
  const [previewParcel, setPreviewParcel] = useState<ParcelFeature | null>(null);
  const [previewUnits, setPreviewUnits] = useState<CadastralUnit[]>([]);
  const [previewAlreadySaved, setPreviewAlreadySaved] = useState(false);

  const [fieldMode, setFieldMode] = useState(false);
  const [fieldTarget, setFieldTarget] = useState<FieldTarget | null>(null);
  const [fieldDataError, setFieldDataError] = useState<string | null>(null);

  const auth = useAuth();
  const data = useCadastreData(includeDeleted, auth.isAuthenticated);
  const field = useFieldLocation();

  const visibleParcels = useMemo(() => {
    const hiddenGroupIds = new Set(
        data.groups.filter((group) => group.is_hidden).map((group) => group.id),
    );

    return data.parcels.filter((parcel) => {
      if (!includeDeleted && parcel.properties.is_deleted) return false;
      return !parcel.properties.group_id || !hiddenGroupIds.has(parcel.properties.group_id);
    });
  }, [data.groups, data.parcels, includeDeleted]);

  const mapParcels = useMemo(() => {
    if (!fieldMode) return visibleParcels;
    return data.parcels.filter((parcel) => !parcel.properties.is_deleted);
  }, [data.parcels, fieldMode, visibleParcels]);

  const selectedParcel = useMemo(
      () => data.parcels.find((parcel) => parcel.properties.cadastral_ref === selectedRc) ?? null,
      [data.parcels, selectedRc],
  );

  const totalVisibleAreaHa = useMemo(
      () => visibleParcels.reduce((total, parcel) => total + (parcel.properties.area_ha ?? 0), 0),
      [visibleParcels],
  );

  useEffect(() => {
    if (selectedRc && !selectedParcel && !data.loading) {
      setSelectedRc(null);
    }
  }, [data.loading, selectedParcel, selectedRc]);

  useEffect(() => {
    if (!fieldMode || !field.location) return;

    const requestId = fieldRequestIdRef.current + 1;
    fieldRequestIdRef.current = requestId;

    const selectedTarget =
        selectedParcel && !selectedParcel.properties.is_deleted
            ? selectedParcel.properties.cadastral_ref
            : null;

    const timer = window.setTimeout(() => {
      void data
          .fieldPosition(
              field.location!.longitude,
              field.location!.latitude,
              selectedTarget,
          )
          .then((result) => {
            if (fieldRequestIdRef.current !== requestId) return;

            setFieldTarget(result.target);
            setFieldDataError(null);

            if (!centeredFirstFieldFixRef.current) {
              centeredFirstFieldFixRef.current = true;
              mapRef.current?.centerLocation(field.location!);
            }
          })
          .catch((error) => {
            if (fieldRequestIdRef.current !== requestId) return;

            setFieldDataError(
                readableApiError(
                    error,
                    "No se pudo calcular tu posición respecto a la finca",
                ),
            );
          });
    }, 500);

    return () => window.clearTimeout(timer);
  }, [data.fieldPosition, field.location, fieldMode, selectedParcel]);

  const searchParcel = async () => {
    const rc = rcInput.replace(/\s+/g, "").toUpperCase();

    if (!RC_RE.test(rc)) {
      data.setNotice({
        type: "error",
        message: "Introduce una referencia catastral válida de 14 a 20 caracteres alfanuméricos",
      });
      return;
    }

    setIsSearching(true);
    data.clearNotice();

    try {
      const parcel = await data.lookupParcel(rc);
      setRcInput("");
      setSelectedRc(parcel.properties.cadastral_ref);
      mapRef.current?.fitParcel(parcel);
    } catch (error) {
      data.setNotice({
        type: "error",
        message: readableApiError(
            error,
            "No se pudo consultar la referencia catastral",
        ),
      });
    } finally {
      setIsSearching(false);
    }
  };

  const stopFieldMode = () => {
    fieldRequestIdRef.current += 1;

    // Clear the visual field overlays immediately, before React finishes
    // updating the field-mode state.
    mapRef.current?.clearFieldMode();

    field.stop();
    setFieldMode(false);
    setFieldTarget(null);
    setFieldDataError(null);
    centeredFirstFieldFixRef.current = false;

    fieldBaseMapRef.current = null;
    fieldShowCatastroRef.current = null;
  };

  const startFieldMode = () => {
    identifyRequestIdRef.current += 1;
    setIdentifyLoading(false);
    setPreviewParcel(null);
    setPreviewUnits([]);
    setPreviewAlreadySaved(false);

    /*
     * Remember the exact map configuration active on Home.
     * Field Mode must preserve it exactly.
     */
    fieldBaseMapRef.current = baseMap;
    fieldShowCatastroRef.current = showCatastro;

    setFieldMode(true);
    setFieldTarget(null);
    setFieldDataError(null);
    centeredFirstFieldFixRef.current = false;

    field.start();
    data.clearNotice();
  };

  useEffect(() => {
    if (!fieldMode) {
      return;
    }

    const expectedBaseMap =
        fieldBaseMapRef.current;

    const expectedShowCatastro =
        fieldShowCatastroRef.current;

    if (
        expectedBaseMap &&
        baseMap !== expectedBaseMap
    ) {
      setBaseMap(expectedBaseMap);
    }

    if (
        expectedShowCatastro != null &&
        showCatastro !== expectedShowCatastro
    ) {
      setShowCatastro(
          expectedShowCatastro,
      );
    }
  }, [
    baseMap,
    fieldMode,
    showCatastro,
    setBaseMap,
    setShowCatastro,
  ]);

  const cancelIdentify = () => {
    if (savingPreview) return;

    identifyRequestIdRef.current += 1;
    setIdentifyLoading(false);
    setPreviewParcel(null);
    setPreviewUnits([]);
    setPreviewAlreadySaved(false);
  };

  const identifyPoint = async (
      longitude: number,
      latitude: number,
  ) => {
    if (identifyLoading || savingPreview || fieldMode) {
      return;
    }

    const requestId = identifyRequestIdRef.current + 1;
    identifyRequestIdRef.current = requestId;

    setIdentifyLoading(true);
    setPreviewParcel(null);
    setPreviewUnits([]);
    setPreviewAlreadySaved(false);
    data.clearNotice();

    try {
      if (USE_MOCK_CADASTRE) {
        const mockParcel: ParcelFeature = {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [[
              [-3.70395, 40.41695],
              [-3.70355, 40.41695],
              [-3.70355, 40.41665],
              [-3.70395, 40.41665],
              [-3.70395, 40.41695],
            ]],
          },
          properties: {
            cadastral_ref: "1234567AB1234C",
            name: null,
            notes: null,
            color: "#f59e0b",
            group_id: null,
            is_deleted: false,
            area_m2: 950,
            area_ha: 0.095,
            perimeter_m: 125,
            source: "mock",
          },
        };

        const mockUnits: CadastralUnit[] = [
          {
            cadastral_ref: "1234567AB1234C0001AA",
            parcel_ref: "1234567AB1234C",
            use: "Vivienda",
            address: "CALLE MAYOR 10 01 A",
            floor: "01",
            door: "A",
            built_area_m2: 82,
          },
          {
            cadastral_ref: "1234567AB1234C0002BB",
            parcel_ref: "1234567AB1234C",
            use: "Vivienda",
            address: "CALLE MAYOR 10 01 B",
            floor: "01",
            door: "B",
            built_area_m2: 78,
          },
          {
            cadastral_ref: "1234567AB1234C0003CC",
            parcel_ref: "1234567AB1234C",
            use: "Local comercial",
            address: "CALLE MAYOR 10 BJ",
            floor: "BJ",
            door: null,
            built_area_m2: 115,
          },
        ];

        setPreviewParcel(mockParcel);
        setPreviewUnits(mockUnits);
        setPreviewAlreadySaved(false);

        return;
      }

      const result = await data.identifyParcel(
          longitude,
          latitude,
      );

      if (identifyRequestIdRef.current !== requestId) {
        return;
      }

      setPreviewParcel(result.parcel);
      setPreviewUnits(result.units ?? []);
      setPreviewAlreadySaved(result.already_saved);

    } catch (error) {
      if (identifyRequestIdRef.current !== requestId) {
        return;
      }

      data.setNotice({
        type: "error",
        message: readableApiError(
            error,
            "No se pudo identificar la parcela bajo el cursor",
        ),
      });
    } finally {
      if (identifyRequestIdRef.current === requestId) {
        setIdentifyLoading(false);
      }
    }
  };

  const savePreviewParcel = async () => {
    if (!previewParcel || identifyLoading || savingPreview) {
      return;
    }

    setSavingPreview(true);

    try {
      const saved = await data.savePreviewParcel(
          previewParcel,
      );

      setSelectedRc(saved.properties.cadastral_ref);
      setPreviewParcel(null);
      setPreviewUnits([]);
      setPreviewAlreadySaved(false);

      mapRef.current?.fitParcel(saved);
    } catch (error) {
      data.setNotice({
        type: "error",
        message: readableApiError(
            error,
            "No se pudo guardar la parcela seleccionada",
        ),
      });
    } finally {
      setSavingPreview(false);
    }
  };

  const openSavedPreview = async () => {
    if (!previewParcel || savingPreview) return;

    setSavingPreview(true);

    try {
      if (previewParcel.properties.is_deleted) {
        await data.updateParcel(
            previewParcel.properties.cadastral_ref,
            { is_deleted: false },
        );
      }

      setSelectedRc(previewParcel.properties.cadastral_ref);
      setPreviewParcel(null);
      setPreviewUnits([]);
      setPreviewAlreadySaved(false);

      mapRef.current?.fitParcel(previewParcel);
    } finally {
      setSavingPreview(false);
    }
  };

  const updateSelectedParcel = async (
      update: Parameters<typeof data.updateParcel>[1],
  ) => {
    if (!selectedParcel) return;

    await data.updateParcel(
        selectedParcel.properties.cadastral_ref,
        update,
    );
  };

  const deleteSelectedParcel = async () => {
    if (!selectedParcel) return;

    await data.deleteParcel(
        selectedParcel.properties.cadastral_ref,
    );

    if (!includeDeleted) {
      setSelectedRc(null);
    }
  };

  useEffect(() => {
    mapRef.current?.resizeFor(480);

    if (!selectedParcel || fieldMode) {
      return;
    }

    const fitTimer = window.setTimeout(() => {
      mapRef.current?.fitParcel(selectedParcel);
    }, 320);

    return () => {
      window.clearTimeout(fitTimer);
    };
  }, [
    fieldMode,
    selectedParcel?.properties.cadastral_ref,
  ]);

  const appClassName = [
    "cad-app",
    fieldMode ? "field-mode-active" : "",
    selectedParcel && !fieldMode
        ? "mobile-detail-open"
        : "",
  ]
      .filter(Boolean)
      .join(" ");

  return (
      <main className={appClassName}>
        <MobileWelcome />
        <Sidebar
            rcInput={rcInput}
            onRcInput={setRcInput}
            onSearch={() => void searchParcel()}
            isSearching={isSearching}
            baseMap={baseMap}
            onBaseMap={setBaseMap}
            showCatastro={showCatastro}
            onShowCatastro={setShowCatastro}
            includeDeleted={includeDeleted}
            onIncludeDeleted={setIncludeDeleted}
            parcels={data.parcels}
            groups={data.groups}
            selectedRc={selectedRc}
            selectedParcel={selectedParcel}
            loading={data.loading}
            onSelectParcel={setSelectedRc}
            onCreateGroup={data.createGroup}
            onUpdateGroup={data.updateGroup}
            onDeleteGroup={data.deleteGroup}
            onUpdateParcel={updateSelectedParcel}
            onDeleteParcel={deleteSelectedParcel}
            onCloseInspector={() => setSelectedRc(null)}
            onCenterSelected={() => {
              if (selectedParcel) {
                mapRef.current?.fitParcel(selectedParcel);
              }
            }}
            onRefresh={data.refreshAll}
            onNotice={data.setNotice}
            onStartFieldMode={startFieldMode}
            onStopFieldMode={stopFieldMode}
            user={auth.user}
            isGuest={auth.isGuest}
            hasGuestData={auth.hasGuestData}
            getGuestMigrationPreview={auth.getGuestMigrationPreview}
            migrateGuestData={auth.migrateGuestData}
            onLogin={auth.login}
            onRegister={auth.register}
            onLogout={auth.logout}
        />

        <section className="cad-map-shell">
          <CadastreMap
              ref={mapRef}
              parcels={mapParcels}
              selectedRc={selectedRc}
              showCatastro={showCatastro}
              baseMap={baseMap}
              previewParcel={previewParcel}
              fieldMode={fieldMode}
              detailMode={Boolean(selectedParcel)}
              fieldLocation={field.location}
              fieldTarget={fieldTarget}
              onSelectParcel={setSelectedRc}
              onIdentifyPoint={(longitude, latitude) => {
                void identifyPoint(longitude, latitude);
              }}
          />

          <div className="map-floating-bar desktop-map-floating-bar">
            <div className="map-status">
              <span className="status-dot" />
              <span>
              {visibleParcels.length}{" "}
                {visibleParcels.length === 1 ? "parcela" : "parcelas"}
                {totalVisibleAreaHa > 0
                    ? ` · ${formatHectares(totalVisibleAreaHa)}`
                    : ""}
            </span>
            </div>

            <button
                type="button"
                className="map-action"
                disabled={!visibleParcels.length || fieldMode}
                onClick={() => mapRef.current?.fitAll()}
            >
              <CrosshairIcon /> Ver todas
            </button>

            {!fieldMode ? (
                <FieldModePanel
                    active={false}
                    status={field.status}
                    location={field.location}
                    target={fieldTarget}
                    error={field.error ?? fieldDataError}
                    lockedToSelection={Boolean(
                        selectedParcel &&
                        !selectedParcel.properties.is_deleted,
                    )}
                    onStart={startFieldMode}
                    onStop={stopFieldMode}
                    onCenterUser={() => {
                      if (field.location) {
                        mapRef.current?.centerLocation(field.location);
                      }
                    }}
                    onCenterParcel={() => {
                      if (fieldTarget) {
                        mapRef.current?.fitParcel(fieldTarget.parcel);
                      }
                    }}
                    onUseDetectedParcel={() => {
                      if (fieldTarget) {
                        setSelectedRc(
                            fieldTarget.parcel.properties.cadastral_ref,
                        );
                      }
                    }}
                    onAutoDetect={() => setSelectedRc(null)}
                />
            ) : null}
          </div>

          {(previewParcel || identifyLoading) && !fieldMode ? (
              <div className="map-picker-overlay">
                <ParcelPickerPanel
                    active
                    loading={identifyLoading || savingPreview}
                    preview={previewParcel}
                    units={previewUnits}
                    alreadySaved={previewAlreadySaved}
                    onStart={() => {}}
                    onCancel={cancelIdentify}
                    onSave={() => void savePreviewParcel()}
                    onOpenSaved={() => void openSavedPreview()}
                />
              </div>
          ) : null}

          {fieldMode ? (
              <div className="field-panel-overlay">
                <FieldModePanel
                    active
                    status={field.status}
                    location={field.location}
                    target={fieldTarget}
                    error={field.error ?? fieldDataError}
                    lockedToSelection={Boolean(
                        selectedParcel &&
                        !selectedParcel.properties.is_deleted,
                    )}
                    onStart={startFieldMode}
                    onStop={stopFieldMode}
                    onCenterUser={() => {
                      if (field.location) {
                        mapRef.current?.centerLocation(field.location);
                      }
                    }}
                    onCenterParcel={() => {
                      if (fieldTarget) {
                        mapRef.current?.fitParcel(fieldTarget.parcel);
                      }
                    }}
                    onUseDetectedParcel={() => {
                      if (fieldTarget) {
                        setSelectedRc(
                            fieldTarget.parcel.properties.cadastral_ref,
                        );
                      }
                    }}
                    onAutoDetect={() => setSelectedRc(null)}
                />
              </div>
          ) : null}
        </section>

        <Notice
            notice={data.notice}
            onClose={data.clearNotice}
        />
      </main>
  );
}
