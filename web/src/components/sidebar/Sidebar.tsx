"use client";

import { MapPinIcon, RefreshIcon } from "@/components/ui/Icons";
import { DataTools } from "@/components/sidebar/DataTools";
import { LayerControls } from "@/components/sidebar/LayerControls";
import { LandSummary } from "@/components/sidebar/LandSummary";
import { ParcelInspector } from "@/components/sidebar/ParcelInspector";
import { ParcelList } from "@/components/sidebar/ParcelList";
import { SearchBar } from "@/components/sidebar/SearchBar";
import { AuthPanel } from "@/components/sidebar/AuthPanel";
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
  user: AuthUser | null;
  isGuest: boolean;
  hasGuestData: boolean;
  getGuestMigrationPreview: () => Promise<GuestMigrationPreview>;
  migrateGuestData: (resolutions?: GuestMigrationResolutions,) => Promise<{ migrated: boolean; groups: number; parcels: number; }>;
  onLogin: (email: string, password: string,) => Promise<unknown>;
  onRegister: (email: string, password: string, displayName?: string,) => Promise<unknown>;
  onLogout: () => void;
}) {
  const activeCount = parcels.filter((parcel) => !parcel.properties.is_deleted).length;

  return (
    <aside className="cad-sidebar">
      <header className="sidebar-header">
        <div className="brand">
          <div className="brand-mark">
            <MapPinIcon />
          </div>

          <div>
            <h1>Catastro Digital</h1>
            <p>Organiza y visualiza tus parcelas</p>
          </div>
        </div>

        <AuthPanel
            user={user}
            isGuest={isGuest}
            hasGuestData={hasGuestData}
            login={onLogin}
            register={onRegister}
            logout={onLogout}
            getGuestMigrationPreview={getGuestMigrationPreview}
            migrateGuestData={migrateGuestData}
            onRefresh={onRefresh}
        />

        <div className="header-actions">
          <div className="summary-pill">
            <strong>{activeCount}</strong>
            <span>
        {activeCount === 1 ? "parcela" : "parcelas"}
      </span>
          </div>

          <button
              type="button"
              className="icon-button refresh-button"
              title="Actualizar datos"
              onClick={() => void onRefresh()}
          >
            <RefreshIcon />
          </button>
        </div>
      </header>

      <section className="search-section">
        <SearchBar value={rcInput} onChange={onRcInput} onSubmit={onSearch} isSearching={isSearching} />
        <p className="search-help">Acepta referencias catastrales de 14 a 20 caracteres.</p>
      </section>

      <LayerControls
        baseMap={baseMap}
        onBaseMap={onBaseMap}
        showCatastro={showCatastro}
        onShowCatastro={onShowCatastro}
        includeDeleted={includeDeleted}
        onIncludeDeleted={onIncludeDeleted}
      />

      <DataTools isGuest={isGuest} onRefresh={onRefresh} onNotice={onNotice} />

      <LandSummary parcels={parcels} groups={groups} />

      <ParcelList
        parcels={parcels}
        groups={groups}
        selectedRc={selectedRc}
        loading={loading}
        onSelect={onSelectParcel}
        onCreateGroup={onCreateGroup}
        onUpdateGroup={onUpdateGroup}
        onDeleteGroup={onDeleteGroup}
      />

      {selectedParcel ? (
        <ParcelInspector
          parcel={selectedParcel}
          groups={groups}
          onClose={onCloseInspector}
          onCenter={onCenterSelected}
          onUpdate={onUpdateParcel}
          onDelete={onDeleteParcel}
        />
      ) : null}
    </aside>
  );
}
