"use client";

import { useMemo, useState } from "react";

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
    | "groups"
    | "tools"
    | "more";

function HomeNavIcon() {
  return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3.5 10.5 12 3l8.5 7.5" />
        <path d="M5.5 9.5V21h13V9.5" />
        <path d="M9.5 21v-6h5v6" />
      </svg>
  );
}

function MapNavIcon() {
  return (
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

function ToolsNavIcon() {
  return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.5 6.5a4 4 0 0 0 4.9 4.9L12 18.8a2.5 2.5 0 1 1-3.5-3.5l7.4-7.4a4 4 0 0 0-1.4-1.4Z" />
        <path d="m5.5 5.5 3 3" />
      </svg>
  );
}

function MoreNavIcon() {
  return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="5" cy="12" r="1.2" />
        <circle cx="12" cy="12" r="1.2" />
        <circle cx="19" cy="12" r="1.2" />
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

                <section className="mobile-home-sheet">
                  <button
                      type="button"
                      className="mobile-sheet-title"
                      onClick={() =>
                          setMobileTab(
                              "parcels",
                          )
                      }
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
                            setMobileTab(
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
                            setMobileTab(
                                "groups",
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
                  Biblioteca
                </span>
                    <h2>
                      Mis parcelas
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
                  <ParcelList
                      parcels={parcels}
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

          {mobileTab === "groups" ? (
              <section className="mobile-page">
                <div className="mobile-page-head">
                  <div>
                <span>
                  Organización
                </span>
                    <h2>
                      Grupos
                    </h2>
                  </div>

                  <button
                      type="button"
                      className="mobile-primary-small"
                      onClick={() =>
                          void createMobileGroup()
                      }
                  >
                    + Grupo
                  </button>
                </div>

                <div className="mobile-page-content">
                  <div className="mobile-group-list">
                    {groupRows.map(
                        (group) => (
                            <button
                                key={group.id}
                                type="button"
                                className="mobile-group-card"
                                onClick={() =>
                                    setMobileTab(
                                        "parcels",
                                    )
                                }
                            >
                      <span className="mobile-group-icon">
                        <FolderNavIcon />
                      </span>

                              <span className="mobile-group-copy">
                        <strong>
                          {group.name}
                        </strong>
                        <span>
                          {group.count}{" "}
                          {group.count ===
                          1
                              ? "parcela"
                              : "parcelas"}
                        </span>
                      </span>

                              <span className="mobile-group-area">
                        {formatHectares(
                            group.areaHa,
                        )}
                      </span>

                              <ChevronRightIcon />
                            </button>
                        ),
                    )}
                  </div>
                </div>
              </section>
          ) : null}

          {mobileTab === "tools" ? (
              <section className="mobile-page">
                <div className="mobile-page-head">
                  <div>
                <span>
                  Terreno
                </span>
                    <h2>
                      Herramientas
                    </h2>
                  </div>
                </div>

                <div className="mobile-page-content">
                  <button
                      type="button"
                      className="mobile-field-card"
                      onClick={
                        onStartFieldMode
                      }
                  >
                <span className="mobile-tool-icon">
                  <CrosshairMiniIcon />
                </span>

                    <span>
                  <strong>
                    Modo Campo
                  </strong>
                  <small>
                    Localízate respecto a
                    tus parcelas con GPS.
                  </small>
                </span>

                    <ChevronRightIcon />
                  </button>

                  <div className="mobile-tool-grid">
                    <button
                        type="button"
                        className={
                          baseMap === "aerial"
                              ? "mobile-tool-card is-active"
                              : "mobile-tool-card"
                        }
                        onClick={() =>
                            onBaseMap(
                                "aerial",
                            )
                        }
                    >
                      <LayersMiniIcon />
                      <strong>
                        Ortofoto
                      </strong>
                      <small>
                        Fotografía aérea
                      </small>
                    </button>

                    <button
                        type="button"
                        className={
                          showCatastro
                              ? "mobile-tool-card is-active"
                              : "mobile-tool-card"
                        }
                        onClick={() =>
                            onShowCatastro(
                                !showCatastro,
                            )
                        }
                    >
                      <MapNavIcon />
                      <strong>
                        Catastro
                      </strong>
                      <small>
                        Límites oficiales
                      </small>
                    </button>
                  </div>

                  <div className="mobile-tool-section">
                    <div className="mobile-tool-section-title">
                      <DatabaseMiniIcon />
                      <strong>
                        Datos y copias
                      </strong>
                    </div>

                    <DataTools
                        isGuest={isGuest}
                        onRefresh={
                          onRefresh
                        }
                        onNotice={
                          onNotice
                        }
                    />
                  </div>
                </div>
              </section>
          ) : null}

          {mobileTab === "more" ? (
              <section className="mobile-page">
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
                  <div className="mobile-account-card">
                    <div className="mobile-account-copy">
                      <strong>
                        {isGuest
                            ? "Estás usando Catastro Digital como invitado"
                            : user?.display_name ??
                            user?.email ??
                            "Mi cuenta"}
                      </strong>

                      <span>
                    {isGuest
                        ? "Tus datos se guardan en este dispositivo."
                        : "Tus datos están sincronizados con tu cuenta."}
                  </span>
                    </div>

                    {authPanel}
                  </div>

                  <label className="mobile-setting-row">
                <span>
                  <strong>
                    Mostrar borradas
                  </strong>
                  <small>
                    Incluye parcelas del
                    historial.
                  </small>
                </span>

                    <span className="switch">
                  <input
                      type="checkbox"
                      checked={
                        includeDeleted
                      }
                      onChange={(
                          event,
                      ) =>
                          onIncludeDeleted(
                              event.target
                                  .checked,
                          )
                      }
                  />
                  <span className="switch-track" />
                </span>
                  </label>

                  <div className="mobile-tool-section">
                    <div className="mobile-tool-section-title">
                      <DatabaseMiniIcon />
                      <strong>
                        Backup e importación
                      </strong>
                    </div>

                    <DataTools
                        isGuest={isGuest}
                        onRefresh={
                          onRefresh
                        }
                        onNotice={
                          onNotice
                        }
                    />
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
                      onCenterSelected
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
                    setMobileTab("home")
                }
            >
              <HomeNavIcon />
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
                    setMobileTab(
                        "parcels",
                    )
                }
            >
              <MapNavIcon />
              <span>Parcelas</span>
            </button>

            <button
                type="button"
                className={
                  mobileTab === "groups"
                      ? "is-active"
                      : ""
                }
                onClick={() =>
                    setMobileTab(
                        "groups",
                    )
                }
            >
              <FolderNavIcon />
              <span>Grupos</span>
            </button>

            <button
                type="button"
                className={
                  mobileTab === "tools"
                      ? "is-active"
                      : ""
                }
                onClick={() =>
                    setMobileTab(
                        "tools",
                    )
                }
            >
              <ToolsNavIcon />
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
                    setMobileTab("more")
                }
            >
              <MoreNavIcon />
              <span>Más</span>
            </button>
          </nav>
        </div>
      </aside>
  );
}
