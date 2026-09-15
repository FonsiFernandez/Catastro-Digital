"use client";

import { useMemo, useState } from "react";
import {
  ChevronIcon,
  EditIcon,
  EyeIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import { formatHectares } from "@/lib/format";
import { DEFAULT_PARCEL_COLOR } from "@/lib/map";
import type { GroupUpdate, ParcelFeature, ParcelGroup } from "@/types/cadastre";

const NO_GROUP = "__none__";

type ParcelListProps = {
  parcels: ParcelFeature[];
  groups: ParcelGroup[];
  selectedRc: string | null;
  loading: boolean;
  onSelect: (cadastralRef: string) => void;
  onCreateGroup: (name: string) => Promise<unknown>;
  onUpdateGroup: (groupId: string, update: GroupUpdate) => Promise<unknown>;
  onDeleteGroup: (groupId: string) => Promise<unknown>;
};

export function ParcelList({
                             parcels,
                             groups,
                             selectedRc,
                             loading,
                             onSelect,
                             onCreateGroup,
                             onUpdateGroup,
                             onDeleteGroup,
                           }: ParcelListProps) {
  const [filter, setFilter] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const filteredParcels = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase("es");
    if (!query) return parcels;
    return parcels.filter((parcel) => {
      const name = parcel.properties.name?.toLocaleLowerCase("es") ?? "";
      const notes = parcel.properties.notes?.toLocaleLowerCase("es") ?? "";
      const rc = parcel.properties.cadastral_ref.toLocaleLowerCase("es");
      return name.includes(query) || rc.includes(query) || notes.includes(query);
    });
  }, [filter, parcels]);

  const byGroup = useMemo(() => {
    const result = new Map<string, ParcelFeature[]>();
    for (const parcel of filteredParcels) {
      const groupId = parcel.properties.group_id ?? NO_GROUP;
      const current = result.get(groupId) ?? [];
      current.push(parcel);
      result.set(groupId, current);
    }
    for (const items of result.values()) {
      items.sort((a, b) => {
        const aLabel = a.properties.name || a.properties.cadastral_ref;
        const bLabel = b.properties.name || b.properties.cadastral_ref;
        return aLabel.localeCompare(bLabel, "es");
      });
    }
    return result;
  }, [filteredParcels]);

  const groupOrder = [NO_GROUP, ...groups.map((group) => group.id)];

  const submitNewGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    await onCreateGroup(name);
    setNewGroupName("");
    setCreatingGroup(false);
  };

  const saveGroupName = async (groupId: string) => {
    const name = editingName.trim();
    setEditingGroupId(null);
    if (!name) return;
    await onUpdateGroup(groupId, { name });
  };

  return (
      <section className="parcel-browser parcel-browser-responsive">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Biblioteca</span>
            <h2>Mis parcelas</h2>
          </div>
          <button className="icon-text-button" type="button" onClick={() => setCreatingGroup(true)}>
            <PlusIcon /> Grupo
          </button>
        </div>

        <label className="list-filter">
          <SearchIcon />
          <input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Nombre, referencia o notas"
          />
        </label>

        {creatingGroup ? (
            <div className="new-group-form">
              <input
                  autoFocus
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void submitNewGroup();
                    if (event.key === "Escape") setCreatingGroup(false);
                  }}
                  placeholder="Nombre del grupo"
              />
              <button type="button" className="small-primary-button" onClick={() => void submitNewGroup()}>
                Crear
              </button>
              <button type="button" className="small-ghost-button" onClick={() => setCreatingGroup(false)}>
                Cancelar
              </button>
            </div>
        ) : null}

        <div className="parcel-list">
          {loading ? (
              <div className="list-loading">
                <span className="spinner" />
                Cargando parcelas…
              </div>
          ) : parcels.length === 0 && groups.length === 0 ? (
              <div className="empty-state">
                <div className="empty-map-icon">⌖</div>
                <h3>Aún no hay parcelas</h3>
                <p>Introduce una referencia catastral o crea un grupo para empezar.</p>
              </div>
          ) : filteredParcels.length === 0 && groups.length === 0 ? (
              <div className="empty-state compact">
                <h3>Sin resultados</h3>
                <p>No hay parcelas que coincidan con el filtro.</p>
              </div>
          ) : (
              groupOrder.map((groupId) => {
                const items = byGroup.get(groupId) ?? [];

                const group = groups.find(
                    (candidate) => candidate.id === groupId,
                );

                if (!group && !items.length) {
                  return null;
                }
                const isCollapsed = collapsed[groupId] ?? false;
                const shownAreaHa = items
                    .filter((parcel) => !parcel.properties.is_deleted)
                    .reduce((total, parcel) => total + (parcel.properties.area_ha ?? 0), 0);

                return (
                    <div className="parcel-group" key={groupId}>
                      <div className="group-header">
                        <button
                            type="button"
                            className="group-collapse"
                            onClick={() => setCollapsed((current) => ({ ...current, [groupId]: !isCollapsed }))}
                        >
                          <ChevronIcon open={!isCollapsed} />
                          {editingGroupId === groupId && group ? (
                              <input
                                  className="group-name-input"
                                  autoFocus
                                  value={editingName}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={(event) => setEditingName(event.target.value)}
                                  onBlur={() => void saveGroupName(group.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") event.currentTarget.blur();
                                    if (event.key === "Escape") setEditingGroupId(null);
                                  }}
                              />
                          ) : (
                              <span>{group?.name ?? "Sin grupo"}</span>
                          )}
                          <span className="group-area">{formatHectares(shownAreaHa)}</span>
                          <span className="group-count">{items.length}</span>
                        </button>

                        {group ? (
                            <div className="group-actions">
                              <button
                                  type="button"
                                  className="icon-button"
                                  title={group.is_hidden ? "Mostrar en mapa" : "Ocultar del mapa"}
                                  onClick={() => void onUpdateGroup(group.id, { is_hidden: !group.is_hidden })}
                              >
                                <EyeIcon hidden={group.is_hidden} />
                              </button>
                              <button
                                  type="button"
                                  className="icon-button"
                                  title="Renombrar grupo"
                                  onClick={() => {
                                    setEditingName(group.name);
                                    setEditingGroupId(group.id);
                                  }}
                              >
                                <EditIcon />
                              </button>
                              <button
                                  type="button"
                                  className="icon-button danger-icon"
                                  title="Eliminar grupo"
                                  onClick={() => {
                                    if (window.confirm(`¿Eliminar el grupo “${group.name}”? Las parcelas no se borrarán.`)) {
                                      void onDeleteGroup(group.id);
                                    }
                                  }}
                              >
                                <TrashIcon />
                              </button>
                            </div>
                        ) : null}
                      </div>

                      {!isCollapsed ? (
                          <div className="group-items">
                            {items.length === 0 ? (
                                <div className="empty-group-message">
                                  Grupo vacío
                                </div>
                            ) : (
                                items.map((parcel) => {
                                  const props = parcel.properties;
                                  const selected =
                                      selectedRc === props.cadastral_ref;
                                  return (
                                      <button
                                          type="button"
                                          key={props.cadastral_ref}
                                          className={`parcel-row${selected ? " is-selected" : ""}${
                                              props.is_deleted ? " is-deleted" : ""
                                          }`}
                                          onClick={() => onSelect(props.cadastral_ref)}
                                      >
                                  <span
                                      className="parcel-color"
                                      style={{
                                        background:
                                            props.color ?? DEFAULT_PARCEL_COLOR,
                                      }}
                                  />

                                        <span className="parcel-main">
                                    <span className="parcel-name">
                                      {props.name?.trim() || "Sin nombre"}
                                    </span>

                                    <span className="parcel-mobile-meta">
                                      <span className="parcel-ref">
                                        {props.cadastral_ref}
                                      </span>
                                    </span>
                                  </span>

                                        <span className="parcel-row-side">
                                          {props.is_deleted ? (
                                              <span className="deleted-badge">
                                        Borrada
                                      </span>
                                          ) : null}

                                          <span className="parcel-mobile-chevron">
                                      →
                                    </span>
                                  </span>
                                      </button>
                                  );
                                })
                            )}
                          </div>
                      ) : null}
                    </div>
                );
              })
          )}
        </div>
      </section>
  );
}
