"use client";

import { useMemo, useRef, useState } from "react";

import { MapPinIcon, RefreshIcon } from "@/components/ui/Icons";
import { DataTools } from "@/components/sidebar/DataTools";
import { LayerControls } from "@/components/sidebar/LayerControls";
import { LandSummary } from "@/components/sidebar/LandSummary";
import { ParcelInspector } from "@/components/sidebar/ParcelInspector";
import { ParcelList } from "@/components/sidebar/ParcelList";
import { SearchBar } from "@/components/sidebar/SearchBar";
import { AuthPanel } from "@/components/sidebar/AuthPanel";
import { formatHectares } from "@/lib/format";
import type { AuthUser } from "@/lib/api";
import type {
    GroupUpdate,
    ParcelFeature,
    ParcelGroup,
    ParcelUpdate,
    NoticeState,
    BaseMapId,
} from "@/types/cadastre";
import type {
    GuestMigrationPreview,
    GuestMigrationResolutions,
} from "@/hooks/useAuth";

type MobileTab =
    | "home"
    | "parcels"
    | "tools"
    | "more";

function HomeNavIcon({
                         filled = false,
                     }: {
    filled?: boolean;
}) {
    return filled ? (
        <svg
            className="is-filled"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path d="M3.5 10.8 12 3.3l8.5 7.5v9.1c0 .7-.6 1.3-1.3 1.3h-4.6v-6.1H9.4v6.1H4.8c-.7 0-1.3-.6-1.3-1.3Z" />
        </svg>
    ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3.5 10.5 12 3l8.5 7.5" />
            <path d="M5.5 9.5V21h13V9.5" />
            <path d="M9.5 21v-6h5v6" />
        </svg>
    );
}

function MapNavIcon({
                        filled = false,
                    }: {
    filled?: boolean;
}) {
    return filled ? (
        <svg
            className="is-filled"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
            <path
                d="M9 3v15M15 6v15"
                className="nav-icon-cut"
            />
        </svg>
    ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z" />
            <path d="M9 3v15M15 6v15" />
        </svg>
    );
}

function FolderNavIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7.5h7l2-2h9v13.5H3Z" />
        </svg>
    );
}

function FieldNavIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="7" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
    );
}

function ToolsNavIcon({
                          filled = false,
                      }: {
    filled?: boolean;
}) {
    return filled ? (
        <svg
            className="is-filled"
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <path d="M20.2 5.1a5.1 5.1 0 0 1-6.3 6.3l-6.8 6.8a2.8 2.8 0 1 1-4-4l6.8-6.8a5.1 5.1 0 0 1 6.3-6.3l-3.1 3.1.8 2.7 2.7.8Z" />
        </svg>
    ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14.5 6.5a4 4 0 0 0 4.9 4.9L12 18.8a2.5 2.5 0 1 1-3.5-3.5l7.4-7.4a4 4 0 0 0-1.4-1.4Z" />
            <path d="m5.5 5.5 3 3" />
        </svg>
    );
}

function MoreNavIcon({
                         filled = false,
                     }: {
    filled?: boolean;
}) {
    return (
        <svg
            className={filled ? "is-filled" : undefined}
            viewBox="0 0 24 24"
            aria-hidden="true"
        >
            <circle cx="5" cy="12" r={filled ? 2.1 : 1.2} />
            <circle cx="12" cy="12" r={filled ? 2.1 : 1.2} />
            <circle cx="19" cy="12" r={filled ? 2.1 : 1.2} />
        </svg>
    );
}

function ChevronRightIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m9 5 7 7-7 7" />
        </svg>
    );
}

function CrosshairMiniIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="6.5" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
        </svg>
    );
}

function LayersMiniIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m12 3 9 5-9 5-9-5Z" />
            <path d="m3 12 9 5 9-5" />
            <path d="m3 16 9 5 9-5" />
        </svg>
    );
}

function DatabaseMiniIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <ellipse cx="12" cy="5" rx="8" ry="3" />
            <path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
            <path d="M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7" />
        </svg>
    );
}


function InfoMiniIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 10v7" />
            <path d="M12 7h.01" />
        </svg>
    );
}

function ShieldMiniIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 20 6v5c0 5-3.3 8.3-8 10-4.7-1.7-8-5-8-10V6Z" />
            <path d="m8.5 12 2.2 2.2 4.8-5" />
        </svg>
    );
}

function ExternalMiniIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 4h6v6" />
            <path d="M20 4 11 13" />
            <path d="M18 13v7H4V6h7" />
        </svg>
    );
}

function PrivacyMiniIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="10" width="14" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
    );
}

export function Sidebar({
                            rcInput,
                            onRcInput,
                            onSearch,
                            isSearching,
                            baseMap,
                            onBaseMap,
                            showCatastro,
                            onShowCatastro,
                            includeDeleted,
                            onIncludeDeleted,
                            parcels,
                            groups,
                            selectedRc,
                            selectedParcel,
                            loading,
                            onSelectParcel,
                            onCreateGroup,
                            onUpdateGroup,
                            onDeleteGroup,
                            onUpdateParcel,
                            onDeleteParcel,
                            onCloseInspector,
                            onCenterSelected,
                            onRefresh,
                            onNotice,
                            onStartFieldMode,
                            user,
                            isGuest,
                            hasGuestData,
                            getGuestMigrationPreview,
                            migrateGuestData,
                            onLogin,
                            onRegister,
                            onLogout,
                        }: {
    rcInput: string;
    onRcInput: (value: string) => void;
    onSearch: () => void;
    isSearching: boolean;
    baseMap: BaseMapId;
    onBaseMap: (value: BaseMapId) => void;
    showCatastro: boolean;
    onShowCatastro: (checked: boolean) => void;
    includeDeleted: boolean;
    onIncludeDeleted: (checked: boolean) => void;
    parcels: ParcelFeature[];
    groups: ParcelGroup[];
    selectedRc: string | null;
    selectedParcel: ParcelFeature | null;
    loading: boolean;
    onSelectParcel: (rc: string) => void;
    onCreateGroup: (name: string) => Promise<unknown>;
    onUpdateGroup: (id: string, update: GroupUpdate) => Promise<unknown>;
    onDeleteGroup: (id: string) => Promise<unknown>;
    onUpdateParcel: (update: ParcelUpdate) => Promise<unknown>;
    onDeleteParcel: () => Promise<unknown>;
    onCloseInspector: () => void;
    onCenterSelected: () => void;
    onRefresh: () => Promise<unknown>;
    onNotice: (notice: NoticeState) => void;
    onStartFieldMode: () => void;
    user: AuthUser | null;
    isGuest: boolean;
    hasGuestData: boolean;
    getGuestMigrationPreview: () => Promise<GuestMigrationPreview>;
    migrateGuestData: (
        resolutions?: GuestMigrationResolutions,
    ) => Promise<{
        migrated: boolean;
        groups: number;
        parcels: number;
    }>;
    onLogin: (
        email: string,
        password: string,
    ) => Promise<unknown>;
    onRegister: (
        email: string,
        password: string,
        displayName?: string,
    ) => Promise<unknown>;
    onLogout: () => void;
}) {
    const [mobileTab, setMobileTab] =
        useState<MobileTab>("home");

    const [
        mobileGroupFilterId,
        setMobileGroupFilterId,
    ] = useState<string | null>(null);

    const [homeSheetCollapsed, setHomeSheetCollapsed] =
        useState(false);

    const [homeSheetDragY, setHomeSheetDragY] =
        useState(0);

    const homeSheetDragStartYRef =
        useRef<number | null>(null);

    const homeSheetPointerIdRef =
        useRef<number | null>(null);

    const startHomeSheetDrag = (
        event: React.PointerEvent<HTMLButtonElement>,
    ) => {
        homeSheetDragStartYRef.current =
            event.clientY;

        homeSheetPointerIdRef.current =
            event.pointerId;

        event.currentTarget.setPointerCapture(
            event.pointerId,
        );
    };

    const moveHomeSheetDrag = (
        event: React.PointerEvent<HTMLButtonElement>,
    ) => {
        if (
            homeSheetDragStartYRef.current ===
            null ||
            homeSheetPointerIdRef.current !==
            event.pointerId
        ) {
            return;
        }

        const delta =
            event.clientY -
            homeSheetDragStartYRef.current;

        if (homeSheetCollapsed) {
            setHomeSheetDragY(
                Math.min(
                    0,
                    Math.max(-170, delta),
                ),
            );
        } else {
            setHomeSheetDragY(
                Math.max(
                    0,
                    Math.min(170, delta),
                ),
            );
        }
    };

    const finishHomeSheetDrag = (
        event: React.PointerEvent<HTMLButtonElement>,
    ) => {
        if (
            homeSheetDragStartYRef.current ===
            null
        ) {
            return;
        }

        const delta =
            event.clientY -
            homeSheetDragStartYRef.current;

        if (
            !homeSheetCollapsed &&
            delta > 55
        ) {
            setHomeSheetCollapsed(true);
        } else if (
            homeSheetCollapsed &&
            delta < -45
        ) {
            setHomeSheetCollapsed(false);
        }

        setHomeSheetDragY(0);
        homeSheetDragStartYRef.current = null;
        homeSheetPointerIdRef.current = null;

        if (
            event.currentTarget.hasPointerCapture(
                event.pointerId,
            )
        ) {
            event.currentTarget.releasePointerCapture(
                event.pointerId,
            );
        }
    };

    const activeParcels = useMemo(
        () =>
            parcels.filter(
                (parcel) =>
                    !parcel.properties.is_deleted,
            ),
        [parcels],
    );

    const activeCount =
        activeParcels.length;

    const totalAreaHa =
        activeParcels.reduce(
            (total, parcel) =>
                total +
                (parcel.properties.area_ha ?? 0),
            0,
        );

    const groupRows = useMemo(() => {
        const parcelGroups =
            new Map<
                string,
                {
                    count: number;
                    areaHa: number;
                }
            >();

        for (const parcel of activeParcels) {
            const key =
                parcel.properties.group_id ??
                "__none__";

            const current =
                parcelGroups.get(key) ?? {
                    count: 0,
                    areaHa: 0,
                };

            current.count += 1;
            current.areaHa +=
                parcel.properties.area_ha ?? 0;

            parcelGroups.set(
                key,
                current,
            );
        }

        return [
            {
                id: "__none__",
                name: "Sin grupo",
                ...(parcelGroups.get(
                    "__none__",
                ) ?? {
                    count: 0,
                    areaHa: 0,
                }),
            },
            ...groups.map((group) => ({
                id: group.id,
                name: group.name,
                ...(parcelGroups.get(
                    group.id,
                ) ?? {
                    count: 0,
                    areaHa: 0,
                }),
            })),
        ];
    }, [activeParcels, groups]);

    const mobileFilteredParcels =
        useMemo(() => {
            if (!mobileGroupFilterId) {
                return parcels;
            }

            return parcels.filter(
                (parcel) => {
                    const groupId =
                        parcel.properties.group_id;

                    if (
                        mobileGroupFilterId ===
                        "__none__"
                    ) {
                        return !groupId;
                    }

                    return (
                        groupId ===
                        mobileGroupFilterId
                    );
                },
            );
        }, [
            mobileGroupFilterId,
            parcels,
        ]);

    const mobileGroupFilterName =
        mobileGroupFilterId
            ? groupRows.find(
            (group) =>
                group.id ===
                mobileGroupFilterId,
        )?.name ?? "Grupo"
            : null;

    const goToMobileTab = (
        tab: MobileTab,
    ) => {
        if (tab === "parcels") {
            setMobileGroupFilterId(null);
        }

        setMobileTab(tab);
    };

    const openMobileGroup = (
        groupId: string,
    ) => {
        setMobileGroupFilterId(groupId);
        setMobileTab("parcels");
    };

    const showMapFromTools = (
        action: () => void,
    ) => {
        action();
        setMobileTab("home");
        setHomeSheetCollapsed(true);
    };

    const showSelectedParcelOnMap =
        () => {
            setMobileTab("home");
            setHomeSheetCollapsed(true);
            onCenterSelected();
        };

    const createMobileGroup =
        async () => {
            const name = window.prompt(
                "Nombre del nuevo grupo",
            );

            if (!name?.trim()) {
                return;
            }

            await onCreateGroup(
                name.trim(),
            );
        };

    const authPanel = (
        <AuthPanel
            user={user}
            isGuest={isGuest}
            hasGuestData={hasGuestData}
            login={onLogin}
            register={onRegister}
            logout={onLogout}
            getGuestMigrationPreview={
                getGuestMigrationPreview
            }
            migrateGuestData={
                migrateGuestData
            }
            onRefresh={onRefresh}
        />
    );

    return (
        <aside className="cad-sidebar">
            {/* ================================================================
          DESKTOP
          ================================================================ */}
            <div className="sidebar-desktop">
                <header className="sidebar-header">
                    <div className="brand">
                        <div className="brand-mark">
                            <MapPinIcon />
                        </div>

                        <div>
                            <h1>
                                Catastro Digital
                            </h1>
                            <p>
                                Organiza y visualiza tus
                                parcelas
                            </p>
                        </div>
                    </div>

                    {authPanel}

                    <div className="header-actions">
                        <div className="summary-pill">
                            <strong>
                                {activeCount}
                            </strong>
                            <span>
                {activeCount === 1
                    ? "parcela"
                    : "parcelas"}
              </span>
                        </div>

                        <button
                            type="button"
                            className="icon-button refresh-button"
                            title="Actualizar datos"
                            onClick={() =>
                                void onRefresh()
                            }
                        >
                            <RefreshIcon />
                        </button>
                    </div>
                </header>

                <section className="search-section">
                    <SearchBar
                        value={rcInput}
                        onChange={onRcInput}
                        onSubmit={onSearch}
                        isSearching={isSearching}
                    />
                    <p className="search-help">
                        Acepta referencias
                        catastrales de 14 a 20
                        caracteres.
                    </p>
                </section>

                <LayerControls
                    baseMap={baseMap}
                    onBaseMap={onBaseMap}
                    showCatastro={showCatastro}
                    onShowCatastro={
                        onShowCatastro
                    }
                    includeDeleted={
                        includeDeleted
                    }
                    onIncludeDeleted={
                        onIncludeDeleted
                    }
                />

                <DataTools
                    isGuest={isGuest}
                    onRefresh={onRefresh}
                    onNotice={onNotice}
                />

                <LandSummary
                    parcels={parcels}
                    groups={groups}
                />

                <ParcelList
                    parcels={parcels}
                    groups={groups}
                    selectedRc={selectedRc}
                    loading={loading}
                    onSelect={onSelectParcel}
                    onCreateGroup={
                        onCreateGroup
                    }
                    onUpdateGroup={
                        onUpdateGroup
                    }
                    onDeleteGroup={
                        onDeleteGroup
                    }
                />

                {selectedParcel ? (
                    <ParcelInspector
                        parcel={selectedParcel}
                        groups={groups}
                        onClose={
                            onCloseInspector
                        }
                        onCenter={
                            onCenterSelected
                        }
                        onUpdate={
                            onUpdateParcel
                        }
                        onDelete={
                            onDeleteParcel
                        }
                    />
                ) : null}
            </div>

            {/* ================================================================
          MOBILE — follows the shared mockup/navigation model
          ================================================================ */}
            <div className="sidebar-mobile">
                {mobileTab === "home" ? (
                    <>
                        <header className="mobile-topbar">
                            <div className="mobile-brand">
                                <div className="mobile-brand-mark">
                                    <MapPinIcon />
                                </div>
                                <strong>
                                    Catastro Digital
                                </strong>
                            </div>

                            <div className="mobile-topbar-account">
                                {authPanel}
                            </div>
                        </header>

                        <section className="mobile-search">
                            <SearchBar
                                value={rcInput}
                                onChange={onRcInput}
                                onSubmit={onSearch}
                                isSearching={
                                    isSearching
                                }
                            />
                        </section>

                        <div
                            className="mobile-map-chips"
                            aria-label="Vista del mapa"
                        >
                            <button
                                type="button"
                                className={
                                    baseMap === "street"
                                        ? "is-active"
                                        : ""
                                }
                                onClick={() =>
                                    onBaseMap("street")
                                }
                            >
                                Mapa
                            </button>

                            <button
                                type="button"
                                className={
                                    baseMap === "aerial"
                                        ? "is-active"
                                        : ""
                                }
                                onClick={() =>
                                    onBaseMap("aerial")
                                }
                            >
                                Ortofoto
                            </button>

                            <button
                                type="button"
                                className={
                                    showCatastro
                                        ? "is-active"
                                        : ""
                                }
                                onClick={() =>
                                    onShowCatastro(
                                        !showCatastro,
                                    )
                                }
                            >
                                Catastro
                            </button>

                            <button
                                type="button"
                                className={
                                    baseMap ===
                                    "topographic"
                                        ? "is-active"
                                        : ""
                                }
                                onClick={() =>
                                    onBaseMap(
                                        "topographic",
                                    )
                                }
                            >
                                Relieve
                            </button>
                        </div>

                        <section
                            className={
                                homeSheetCollapsed
                                    ? "mobile-home-sheet is-collapsed"
                                    : "mobile-home-sheet"
                            }
                            style={
                                {
                                    "--mobile-sheet-drag-y":
                                        `${homeSheetDragY}px`,
                                } as React.CSSProperties
                            }
                        >
                            <button
                                type="button"
                                className="mobile-sheet-handle"
                                aria-label={
                                    homeSheetCollapsed
                                        ? "Desliza hacia arriba para mostrar Mis parcelas"
                                        : "Desliza hacia abajo para ocultar Mis parcelas"
                                }
                                onPointerDown={
                                    startHomeSheetDrag
                                }
                                onPointerMove={
                                    moveHomeSheetDrag
                                }
                                onPointerUp={
                                    finishHomeSheetDrag
                                }
                                onPointerCancel={
                                    finishHomeSheetDrag
                                }
                                onDoubleClick={() =>
                                    setHomeSheetCollapsed(
                                        (current) =>
                                            !current,
                                    )
                                }
                            >
                                <span />
                            </button>

                            <button
                                type="button"
                                className="mobile-sheet-title"
                                onClick={() => {
                                    if (homeSheetCollapsed) {
                                        setHomeSheetCollapsed(
                                            false,
                                        );
                                        return;
                                    }

                                    goToMobileTab(
                                        "parcels",
                                    );
                                }}
                            >
                                <strong>
                                    Mis parcelas
                                </strong>
                                <ChevronRightIcon />
                            </button>

                            <div className="mobile-summary-grid">
                                <button
                                    type="button"
                                    className="mobile-summary-card"
                                    onClick={() =>
                                        goToMobileTab(
                                            "parcels",
                                        )
                                    }
                                >
                  <span className="mobile-summary-icon">
                    <MapNavIcon />
                  </span>
                                    <strong>
                                        {activeCount}
                                    </strong>
                                    <span>
                    Parcelas guardadas
                  </span>
                                </button>

                                <button
                                    type="button"
                                    className="mobile-summary-card"
                                    onClick={() =>
                                        goToMobileTab(
                                            "parcels",
                                        )
                                    }
                                >
                  <span className="mobile-summary-icon">
                    <FolderNavIcon />
                  </span>
                                    <strong>
                                        {groups.length}
                                    </strong>
                                    <span>
                    Grupos de parcelas
                  </span>
                                </button>

                                <div className="mobile-summary-card">
                  <span className="mobile-summary-icon">
                    <LayersMiniIcon />
                  </span>
                                    <strong>
                                        {formatHectares(
                                            totalAreaHa,
                                        )}
                                    </strong>
                                    <span>
                    Superficie total
                  </span>
                                </div>
                            </div>
                        </section>
                    </>
                ) : null}

                {mobileTab === "parcels" ? (
                    <section className="mobile-page">
                        <div className="mobile-page-head">
                            <div>
                <span>
                  {mobileGroupFilterName
                      ? "Grupo"
                      : "Biblioteca"}
                </span>
                                <h2>
                                    {mobileGroupFilterName ??
                                        "Mis parcelas"}
                                </h2>
                            </div>

                            <button
                                type="button"
                                className="mobile-refresh"
                                onClick={() =>
                                    void onRefresh()
                                }
                                aria-label="Actualizar parcelas"
                            >
                                <RefreshIcon />
                            </button>
                        </div>

                        <div className="mobile-page-content mobile-parcels-content">
                            {mobileGroupFilterName ? (
                                <div className="mobile-parcel-filter">
                  <span>
                    Mostrando parcelas de
                    <strong>
                      {mobileGroupFilterName}
                    </strong>
                  </span>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setMobileGroupFilterId(
                                                null,
                                            )
                                        }
                                    >
                                        Ver todas
                                    </button>
                                </div>
                            ) : null}

                            <ParcelList
                                parcels={
                                    mobileFilteredParcels
                                }
                                groups={groups}
                                selectedRc={
                                    selectedRc
                                }
                                loading={loading}
                                onSelect={
                                    onSelectParcel
                                }
                                onCreateGroup={
                                    onCreateGroup
                                }
                                onUpdateGroup={
                                    onUpdateGroup
                                }
                                onDeleteGroup={
                                    onDeleteGroup
                                }
                            />
                        </div>
                    </section>
                ) : null}



                {mobileTab === "tools" ? (
                    <section className="mobile-page mobile-tools-page">
                        <div className="mobile-page-head">
                            <div>
                <span>
                  Mapa y territorio
                </span>
                                <h2>
                                    Herramientas
                                </h2>
                            </div>
                        </div>

                        <div className="mobile-page-content">
                            <button
                                type="button"
                                className="mobile-field-card mobile-feature-card"
                                onClick={onStartFieldMode}
                            >
                <span className="mobile-tool-icon mobile-tool-icon-primary">
                  <CrosshairMiniIcon />
                </span>

                                <span>
                  <strong>
                    Modo Campo
                  </strong>
                  <small>
                    Usa el GPS para saber si estás dentro de una parcela y consultar la distancia a sus límites.
                  </small>
                </span>

                                <ChevronRightIcon />
                            </button>

                            <div className="mobile-tools-heading">
                                <span>Vista del mapa</span>
                                <small>
                                    Elige cómo quieres visualizar el terreno.
                                </small>
                            </div>

                            <div className="mobile-tool-grid mobile-tool-grid-map">
                                <button
                                    type="button"
                                    className={
                                        baseMap === "street"
                                            ? "mobile-tool-card is-active"
                                            : "mobile-tool-card"
                                    }
                                    onClick={() =>
                                        showMapFromTools(
                                            () => onBaseMap("street"),
                                        )
                                    }
                                >
                                    <MapNavIcon />
                                    <strong>Mapa</strong>
                                    <small>Vista general</small>
                                </button>

                                <button
                                    type="button"
                                    className={
                                        baseMap === "aerial"
                                            ? "mobile-tool-card is-active"
                                            : "mobile-tool-card"
                                    }
                                    onClick={() =>
                                        showMapFromTools(
                                            () => onBaseMap("aerial"),
                                        )
                                    }
                                >
                                    <LayersMiniIcon />
                                    <strong>Ortofoto</strong>
                                    <small>Fotografía aérea</small>
                                </button>

                                <button
                                    type="button"
                                    className={
                                        baseMap === "topographic"
                                            ? "mobile-tool-card is-active"
                                            : "mobile-tool-card"
                                    }
                                    onClick={() =>
                                        showMapFromTools(
                                            () =>
                                                onBaseMap(
                                                    "topographic",
                                                ),
                                        )
                                    }
                                >
                                    <LayersMiniIcon />
                                    <strong>Relieve</strong>
                                    <small>Vista topográfica</small>
                                </button>

                                <button
                                    type="button"
                                    className={
                                        showCatastro
                                            ? "mobile-tool-card is-active is-cadastre"
                                            : "mobile-tool-card is-cadastre"
                                    }
                                    onClick={() =>
                                        showMapFromTools(
                                            () =>
                                                onShowCatastro(
                                                    !showCatastro,
                                                ),
                                        )
                                    }
                                >
                                    <MapNavIcon />
                                    <strong>Catastro</strong>
                                    <small>
                                        Límites catastrales
                                    </small>
                                </button>
                            </div>

                            <div className="mobile-tools-heading">
                                <span>Datos</span>
                                <small>
                                    Importa, exporta o crea una copia de tus parcelas y grupos.
                                </small>
                            </div>

                            <div className="mobile-tool-section mobile-data-tools-card">
                                <div className="mobile-tool-section-title">
                                    <DatabaseMiniIcon />
                                    <div>
                                        <strong>
                                            Importación y copias
                                        </strong>
                                        <small>
                                            Backup JSON, GeoJSON e importación de datos.
                                        </small>
                                    </div>
                                </div>

                                <DataTools
                                    isGuest={isGuest}
                                    onRefresh={onRefresh}
                                    onNotice={onNotice}
                                />
                            </div>

                            <button
                                type="button"
                                className="mobile-simple-action"
                                onClick={() => void onRefresh()}
                            >
                <span className="mobile-simple-action-icon">
                  <RefreshIcon />
                </span>
                                <span>
                  <strong>Actualizar datos</strong>
                  <small>
                    Vuelve a cargar parcelas, grupos y datos disponibles.
                  </small>
                </span>
                                <ChevronRightIcon />
                            </button>
                        </div>
                    </section>
                ) : null}

                {mobileTab === "more" ? (
                    <section className="mobile-page mobile-more-page">
                        <div className="mobile-page-head">
                            <div>
                <span>
                  Catastro Digital
                </span>
                                <h2>
                                    Más
                                </h2>
                            </div>
                        </div>

                        <div className="mobile-page-content">
                            <div className="mobile-account-card mobile-account-card-refined">
                                <div className="mobile-account-copy">
                  <span className="mobile-account-kicker">
                    {isGuest ? "Modo invitado" : "Cuenta"}
                  </span>

                                    <strong>
                                        {isGuest
                                            ? "Tus parcelas, en este dispositivo"
                                            : user?.display_name ??
                                            user?.email ??
                                            "Mi cuenta"}
                                    </strong>

                                    <span>
                    {isGuest
                        ? "Puedes usar Catastro Digital sin cuenta. Si inicias sesión, podrás guardar y sincronizar tus datos."
                        : "Tus parcelas y grupos están asociados a tu cuenta."}
                  </span>
                                </div>

                                {authPanel}
                            </div>

                            <div className="mobile-tools-heading">
                                <span>Preferencias</span>
                            </div>

                            <label className="mobile-setting-row mobile-setting-card">
                <span>
                  <strong>
                    Mostrar borradas
                  </strong>
                  <small>
                    Incluye las parcelas eliminadas en la biblioteca para poder restaurarlas.
                  </small>
                </span>

                                <span className="switch">
                  <input
                      type="checkbox"
                      checked={includeDeleted}
                      onChange={(event) =>
                          onIncludeDeleted(
                              event.target.checked,
                          )
                      }
                  />
                  <span className="switch-track" />
                </span>
                            </label>

                            <div className="mobile-tools-heading">
                                <span>Sobre el proyecto</span>
                            </div>

                            <details className="mobile-info-card" open>
                                <summary>
                  <span className="mobile-info-icon">
                    <InfoMiniIcon />
                  </span>
                                    <span>
                    <strong>
                      Catastro Digital
                    </strong>
                    <small>
                      Qué es y para qué sirve
                    </small>
                  </span>
                                    <ChevronRightIcon />
                                </summary>

                                <div className="mobile-info-content">
                                    <p>
                                        Catastro Digital es una herramienta para organizar parcelas, visualizarlas sobre el mapa y trabajar con ellas desde el terreno.
                                    </p>
                                    <p>
                                        El proyecto permite usar la aplicación como invitado o con cuenta, organizar fincas por grupos, consultar información catastral disponible y utilizar herramientas de localización.
                                    </p>

                                    <a
                                        className="mobile-info-link"
                                        href="https://github.com/FonsiFernandez/Catastro-Digital"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        Ver proyecto en GitHub
                                        <ExternalMiniIcon />
                                    </a>
                                </div>
                            </details>

                            <details className="mobile-info-card">
                                <summary>
                  <span className="mobile-info-icon">
                    <DatabaseMiniIcon />
                  </span>
                                    <span>
                    <strong>
                      Fuentes de datos
                    </strong>
                    <small>
                      Catastro, mapas y servicios externos
                    </small>
                  </span>
                                    <ChevronRightIcon />
                                </summary>

                                <div className="mobile-info-content">
                                    <p>
                                        La información catastral mostrada por la aplicación procede de servicios públicos y externos, entre ellos los servicios INSPIRE de la Dirección General del Catastro cuando están disponibles.
                                    </p>
                                    <p>
                                        Las capas de mapa, ortofoto o relieve pueden depender de proveedores externos configurados por la aplicación. Su disponibilidad, cobertura y actualización no dependen de Catastro Digital.
                                    </p>
                                    <p>
                                        Los datos obtenidos de fuentes externas pueden estar temporalmente inaccesibles, incompletos, desactualizados o contener diferencias respecto a la documentación oficial vigente.
                                    </p>
                                </div>
                            </details>

                            <details className="mobile-info-card mobile-info-warning">
                                <summary>
                  <span className="mobile-info-icon">
                    <ShieldMiniIcon />
                  </span>
                                    <span>
                    <strong>
                      Aviso legal y limitaciones
                    </strong>
                    <small>
                      Uso orientativo de los datos
                    </small>
                  </span>
                                    <ChevronRightIcon />
                                </summary>

                                <div className="mobile-info-content">
                                    <p>
                                        Catastro Digital es una herramienta informativa y de apoyo. No sustituye certificados catastrales, escrituras, información registral, resoluciones administrativas ni documentación oficial.
                                    </p>
                                    <p>
                                        Los límites, superficies, posiciones GPS y distancias mostrados son orientativos. No deben utilizarse por sí solos para deslindes, mediciones topográficas, litigios, compraventas, obras o cualquier decisión con efectos jurídicos.
                                    </p>
                                    <p>
                                        Cuando una medición o límite sea relevante legalmente, debe verificarse mediante las administraciones competentes y, cuando corresponda, mediante un profesional cualificado.
                                    </p>
                                    <p>
                                        Catastro Digital no controla la exactitud, continuidad o disponibilidad de los servicios y datos proporcionados por terceros.
                                    </p>
                                </div>
                            </details>

                            <details className="mobile-info-card">
                                <summary>
                  <span className="mobile-info-icon">
                    <PrivacyMiniIcon />
                  </span>
                                    <span>
                    <strong>
                      Privacidad y almacenamiento
                    </strong>
                    <small>
                      Cómo se guardan tus datos
                    </small>
                  </span>
                                    <ChevronRightIcon />
                                </summary>

                                <div className="mobile-info-content">
                                    <p>
                                        En modo invitado, tus parcelas y grupos se almacenan localmente en este dispositivo. Si borras los datos del navegador o desinstalas la aplicación, esos datos pueden perderse.
                                    </p>
                                    <p>
                                        Cuando utilizas una cuenta, los datos asociados a tu biblioteca se guardan en el servidor para poder recuperarlos y sincronizarlos.
                                    </p>
                                    <p>
                                        La ubicación utilizada por Modo Campo se usa para calcular tu posición respecto a las parcelas. La interfaz debe solicitar permiso del dispositivo antes de acceder al GPS.
                                    </p>
                                </div>
                            </details>

                            <div className="mobile-legal-note">
                                <ShieldMiniIcon />
                                <span>
                  La información mostrada es orientativa. Para cualquier uso oficial o legal, consulta siempre las fuentes y organismos competentes.
                </span>
                            </div>
                        </div>
                    </section>
                ) : null}

                {selectedParcel ? (
                    <div className="mobile-inspector-layer">
                        <ParcelInspector
                            parcel={
                                selectedParcel
                            }
                            groups={groups}
                            onClose={
                                onCloseInspector
                            }
                            onCenter={
                                showSelectedParcelOnMap
                            }
                            onUpdate={
                                onUpdateParcel
                            }
                            onDelete={
                                onDeleteParcel
                            }
                        />
                    </div>
                ) : null}

                <nav
                    className="mobile-bottom-nav"
                    aria-label="Navegación principal"
                >
                    <button
                        type="button"
                        className={
                            mobileTab === "home"
                                ? "is-active"
                                : ""
                        }
                        onClick={() =>
                            goToMobileTab("home")
                        }
                    >
                        <HomeNavIcon filled={mobileTab === "home"} />
                        <span>Inicio</span>
                    </button>

                    <button
                        type="button"
                        className={
                            mobileTab === "parcels"
                                ? "is-active"
                                : ""
                        }
                        onClick={() =>
                            goToMobileTab(
                                "parcels",
                            )
                        }
                    >
                        <MapNavIcon filled={mobileTab === "parcels"} />
                        <span>Parcelas</span>
                    </button>

                    <button
                        type="button"
                        className="mobile-field-nav"
                        onClick={onStartFieldMode}
                        aria-label="Abrir Modo Campo"
                    >
            <span className="mobile-field-nav-icon">
              <FieldNavIcon />
            </span>
                        <span>Campo</span>
                    </button>

                    <button
                        type="button"
                        className={
                            mobileTab === "tools"
                                ? "is-active"
                                : ""
                        }
                        onClick={() =>
                            goToMobileTab(
                                "tools",
                            )
                        }
                    >
                        <ToolsNavIcon filled={mobileTab === "tools"} />
                        <span>
              Herramientas
            </span>
                    </button>

                    <button
                        type="button"
                        className={
                            mobileTab === "more"
                                ? "is-active"
                                : ""
                        }
                        onClick={() =>
                            goToMobileTab("more")
                        }
                    >
                        <MoreNavIcon filled={mobileTab === "more"} />
                        <span>Más</span>
                    </button>
                </nav>
            </div>
        </aside>
    );
}
