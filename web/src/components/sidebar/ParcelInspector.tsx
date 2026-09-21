"use client";

import { useEffect, useMemo, useState } from "react";

import {
  CloseIcon,
  CopyIcon,
  CrosshairIcon,
  RestoreIcon,
  RulerIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import {
  cadastreApi,
  readableApiError,
} from "@/lib/api";
import {
  formatDistance,
  formatHectares,
  formatNumber,
} from "@/lib/format";
import { guestDb } from "@/lib/guestDb";
import { DEFAULT_PARCEL_COLOR } from "@/lib/map";
import type {
  CadastralUnit,
  ParcelFeature,
  ParcelGroup,
  ParcelUpdate,
} from "@/types/cadastre";

import unitStyles from "./ParcelInspectorUnits.module.css";

function BackIcon() {
  return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m15 5-7 7 7 7" />
      </svg>
  );
}

function ShareIcon() {
  return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 16V3" />
        <path d="m7 8 5-5 5 5" />
        <path d="M5 11v9h14v-9" />
      </svg>
  );
}

function MapArrowIcon() {
  return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 12 16-8-7 16-2.2-6.8Z" />
      </svg>
  );
}

function NoteIcon() {
  return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 4h14v12l-4 4H5Z" />
        <path d="M15 20v-4h4" />
        <path d="M8 8h8M8 12h6" />
      </svg>
  );
}

function AreaIcon() {
  return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 8V5h3M16 5h3v3M19 16v3h-3M8 19H5v-3" />
        <path d="M8 8h8v8H8Z" />
      </svg>
  );
}

function unitTitle(
    unit: CadastralUnit,
): string {
  const position = [
    unit.floor
        ? `Planta ${unit.floor}`
        : null,
    unit.door
        ? `Puerta ${unit.door}`
        : null,
  ]
      .filter(Boolean)
      .join(" · ");

  return (
      position ||
      unit.use ||
      "Inmueble"
  );
}

function mergeUnits(
    available: CadastralUnit[],
    selected: CadastralUnit[],
): CadastralUnit[] {
  const byRef =
      new Map<string, CadastralUnit>();

  for (const unit of available) {
    byRef.set(
        unit.cadastral_ref,
        unit,
    );
  }

  /*
   * Keep already-saved units visible even if Catastro's
   * alphanumeric service is temporarily unavailable.
   */
  for (const unit of selected) {
    if (
        !byRef.has(
            unit.cadastral_ref,
        )
    ) {
      byRef.set(
          unit.cadastral_ref,
          unit,
      );
    }
  }

  return Array.from(
      byRef.values(),
  ).sort((a, b) =>
      a.cadastral_ref.localeCompare(
          b.cadastral_ref,
          "es",
      ),
  );
}

function sameSelection(
    a: string[],
    b: string[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const left =
      [...a].sort();

  const right =
      [...b].sort();

  return left.every(
      (value, index) =>
          value === right[index],
  );
}

function ParcelUnitsEditor({
                             cadastralRef,
                             isGuest,
                             isDeleted,
                           }: {
  cadastralRef: string;
  isGuest: boolean;
  isDeleted: boolean;
}) {
  const [units, setUnits] =
      useState<CadastralUnit[]>([]);

  const [
    selectedRefs,
    setSelectedRefs,
  ] = useState<string[]>([]);

  const [
    savedSelectedRefs,
    setSavedSelectedRefs,
  ] = useState<string[]>([]);

  const [loading, setLoading] =
      useState(true);

  const [saving, setSaving] =
      useState(false);

  const [
    loadWarning,
    setLoadWarning,
  ] = useState<string | null>(null);

  const [
    saveMessage,
    setSaveMessage,
  ] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load =
        async () => {
          setLoading(true);
          setLoadWarning(null);
          setSaveMessage(null);
          setUnits([]);
          setSelectedRefs([]);
          setSavedSelectedRefs([]);

          let selected:
              CadastralUnit[] = [];

          try {
            selected = isGuest
                ? await guestDb.listUnits(
                    cadastralRef,
                )
                : (
                    await cadastreApi.parcels
                        .selectedUnits(
                            cadastralRef,
                        )
                ).units;
          } catch (error) {
            if (cancelled) {
              return;
            }

            setLoadWarning(
                readableApiError(
                    error,
                    "No se pudo cargar la selección de inmuebles guardada",
                ),
            );
          }

          let available:
              CadastralUnit[] = [];

          try {
            available = (
                await cadastreApi.parcels
                    .units(
                        cadastralRef,
                    )
            ).units;
          } catch (error) {
            if (cancelled) {
              return;
            }

            /*
             * Saved units are still useful if Catastro
             * cannot refresh the full unit catalogue.
             */
            if (selected.length > 0) {
              setLoadWarning(
                  "No se pudo actualizar la lista completa desde Catastro. " +
                  "Se muestran los inmuebles que ya estaban guardados.",
              );
            } else {
              setLoadWarning(
                  readableApiError(
                      error,
                      "No se pudieron cargar los inmuebles asociados",
                  ),
              );
            }
          }

          if (cancelled) {
            return;
          }

          const merged =
              mergeUnits(
                  available,
                  selected,
              );

          const selectedIds =
              selected.map(
                  (unit) =>
                      unit.cadastral_ref,
              );

          setUnits(merged);
          setSelectedRefs(
              selectedIds,
          );
          setSavedSelectedRefs(
              selectedIds,
          );
          setLoading(false);
        };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    cadastralRef,
    isGuest,
  ]);

  const hasChanges =
      useMemo(
          () =>
              !sameSelection(
                  selectedRefs,
                  savedSelectedRefs,
              ),
          [
            savedSelectedRefs,
            selectedRefs,
          ],
      );

  const toggleUnit = (
      cadastralUnitRef: string,
  ) => {
    if (
        isDeleted ||
        saving
    ) {
      return;
    }

    setSaveMessage(null);

    setSelectedRefs(
        (current) =>
            current.includes(
                cadastralUnitRef,
            )
                ? current.filter(
                    (value) =>
                        value !==
                        cadastralUnitRef,
                )
                : [
                  ...current,
                  cadastralUnitRef,
                ],
    );
  };

  const save = async () => {
    if (
        saving ||
        isDeleted ||
        !hasChanges
    ) {
      return;
    }

    const selectedUnits =
        units.filter(
            (unit) =>
                selectedRefs.includes(
                    unit.cadastral_ref,
                ),
        );

    setSaving(true);
    setSaveMessage(null);

    try {
      if (isGuest) {
        await guestDb.replaceUnits(
            cadastralRef,
            selectedUnits,
        );
      } else {
        await cadastreApi.parcels
            .saveUnitSelection(
                cadastralRef,
                selectedUnits,
            );
      }

      setSavedSelectedRefs(
          [...selectedRefs],
      );

      setSaveMessage(
          selectedUnits.length === 0
              ? "Todos los inmuebles se han quitado de esta parcela."
              : "Selección de inmuebles guardada.",
      );
    } catch (error) {
      setSaveMessage(
          readableApiError(
              error,
              "No se pudieron guardar los cambios de inmuebles",
          ),
      );
    } finally {
      setSaving(false);
    }
  };

  const selectedCount =
      selectedRefs.length;

  /*
   * Keep the section visible while loading or if an error happened.
   * If Catastro confirms that there are no units at all, there is
   * nothing useful to display in the parcel detail.
   */
  if (
      !loading &&
      units.length === 0 &&
      !loadWarning
  ) {
    return null;
  }

  return (
      <section
          className={unitStyles.section}
          aria-label="Inmuebles asociados"
      >
        <div className={unitStyles.header}>
          <div className={unitStyles.headerCopy}>
            <strong>
              Inmuebles asociados
            </strong>

            <span>
              Puedes cambiar qué referencias
              forman parte de esta parcela guardada.
            </span>
          </div>

          {!loading ? (
              <span className={unitStyles.count}>
                {selectedCount}/{units.length}
              </span>
          ) : null}
        </div>

        {loadWarning ? (
            <div
                className={`${unitStyles.state} ${unitStyles.warning}`}
                role="status"
            >
              {loadWarning}
            </div>
        ) : null}

        {loading ? (
            <div className={unitStyles.state}>
              Cargando inmuebles…
            </div>
        ) : units.length > 0 ? (
            <>
              <div className={unitStyles.list}>
                {units.map((unit) => {
                  const checked =
                      selectedRefs.includes(
                          unit.cadastral_ref,
                      );

                  return (
                      <label
                          key={
                            unit.cadastral_ref
                          }
                          className={
                            unitStyles.unit
                          }
                      >
                        <input
                            type="checkbox"
                            checked={checked}
                            disabled={
                              isDeleted ||
                              saving
                            }
                            onChange={() =>
                                toggleUnit(
                                    unit.cadastral_ref,
                                )
                            }
                        />

                        <span
                            className={
                              unitStyles.unitCopy
                            }
                        >
                          <strong>
                            {unitTitle(unit)}
                          </strong>

                          <code>
                            {unit.cadastral_ref}
                          </code>

                          {unit.address ? (
                              <span>
                                {unit.address}
                              </span>
                          ) : null}

                          {unit.use &&
                          unitTitle(unit) !==
                          unit.use ? (
                              <span>
                                {unit.use}
                              </span>
                          ) : null}
                        </span>

                        {unit.built_area_m2 != null ? (
                            <span
                                className={
                                  unitStyles.area
                                }
                            >
                              {formatNumber(
                                  unit.built_area_m2,
                                  0,
                              )}{" "}
                              m²
                            </span>
                        ) : null}
                      </label>
                  );
                })}
              </div>

              <div className={unitStyles.actions}>
                <span
                    className={
                      unitStyles.actionsCopy
                    }
                >
                  {isDeleted
                      ? "Restaura la parcela para editar sus inmuebles."
                      : selectedCount === 0
                          ? "La parcela se conservará aunque no tenga inmuebles seleccionados."
                          : `${selectedCount} ${selectedCount === 1 ? "inmueble seleccionado" : "inmuebles seleccionados"}`}
                </span>

                <button
                    type="button"
                    className={`secondary-button ${unitStyles.saveButton}`}
                    disabled={
                      isDeleted ||
                      saving ||
                      !hasChanges
                    }
                    onClick={() =>
                        void save()
                    }
                >
                  {saving
                      ? "Guardando…"
                      : "Guardar cambios"}
                </button>
              </div>

              {saveMessage ? (
                  <div
                      className={`${unitStyles.state} ${unitStyles.success}`}
                      role="status"
                  >
                    {saveMessage}
                  </div>
              ) : null}
            </>
        ) : (
            <div className={unitStyles.state}>
              No hay inmuebles disponibles para esta parcela.
            </div>
        )}
      </section>
  );
}

export function ParcelInspector({
                                  parcel,
                                  groups,
                                  isGuest,
                                  onClose,
                                  onCenter,
                                  onUpdate,
                                  onDelete,
                                }: {
  parcel: ParcelFeature;
  groups: ParcelGroup[];
  isGuest: boolean;
  onClose: () => void;
  onCenter: () => void;
  onUpdate: (
      update: ParcelUpdate,
  ) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const props =
      parcel.properties;

  const [name, setName] =
      useState(
          props.name ?? "",
      );

  const [notes, setNotes] =
      useState(
          props.notes ?? "",
      );

  const [copied, setCopied] =
      useState(false);

  const groupName =
      groups.find(
          (group) =>
              group.id ===
              props.group_id,
      )?.name ??
      "Sin grupo";

  useEffect(() => {
    setName(
        props.name ?? "",
    );

    setNotes(
        props.notes ?? "",
    );
  }, [
    props.cadastral_ref,
    props.name,
    props.notes,
  ]);

  const saveName =
      async () => {
        const next =
            name.trim();

        if (
            next ===
            (props.name ?? "")
        ) {
          return;
        }

        await onUpdate({
          name: next,
        });
      };

  const saveNotes =
      async () => {
        const next =
            notes.trim();

        if (
            next ===
            (props.notes ?? "")
        ) {
          return;
        }

        await onUpdate({
          notes: next,
        });
      };

  const copyReference =
      async () => {
        await navigator.clipboard
            .writeText(
                props.cadastral_ref,
            );

        setCopied(true);

        window.setTimeout(
            () =>
                setCopied(false),
            1500,
        );
      };

  const shareParcel =
      async () => {
        const title =
            props.name?.trim() ||
            "Parcela";

        const text =
            `${title}\nReferencia catastral: ${props.cadastral_ref}`;

        if (navigator.share) {
          try {
            await navigator.share({
              title:
                  `${title} · Catastro Digital`,
              text,
            });

            return;
          } catch (error) {
            if (
                error instanceof
                DOMException &&
                error.name ===
                "AbortError"
            ) {
              return;
            }
          }
        }

        await navigator.clipboard
            .writeText(text);

        setCopied(true);

        window.setTimeout(
            () =>
                setCopied(false),
            1500,
        );
      };

  const openOnMap = () => {
    onCenter();
    onClose();
  };

  const deleteParcel = () => {
    if (
        window.confirm(
            "¿Mover esta parcela a borradas?",
        )
    ) {
      void onDelete();
    }
  };

  return (
      <>
        {/* ===============================================================
          DESKTOP
          =============================================================== */}
        <section className="parcel-inspector parcel-inspector-desktop">
          <div className="inspector-heading">
            <div>
              <span className="eyebrow">
                Parcela seleccionada
              </span>

              <h2>
                {props.name?.trim() ||
                    "Sin nombre"}
              </h2>
            </div>

            <button
                className="close-inspector"
                type="button"
                onClick={onClose}
                aria-label="Cerrar detalle"
            >
              <CloseIcon />
            </button>
          </div>

          <button
              className="inspector-ref"
              type="button"
              onClick={() =>
                  void copyReference()
              }
              title="Copiar referencia"
          >
            <code>
              {props.cadastral_ref}
            </code>

            <span>
              {copied
                  ? "Copiada"
                  : <CopyIcon />}
            </span>
          </button>

          <div className="parcel-metrics">
            <div className="metric-card metric-primary">
              <span>
                Superficie
              </span>

              <strong>
                {formatHectares(
                    props.area_ha,
                )}
              </strong>

              <small>
                {props.area_m2 == null
                    ? "—"
                    : `${formatNumber(
                        props.area_m2,
                        0,
                    )} m²`}
              </small>
            </div>

            <div className="metric-card">
              <span>
                Perímetro
              </span>

              <strong>
                <RulerIcon />

                {formatDistance(
                    props.perimeter_m,
                )}
              </strong>

              <small>
                contorno catastral
              </small>
            </div>
          </div>

          <div className="inspector-fields">
            <label className="field">
              <span>
                Nombre
              </span>

              <input
                  value={name}
                  onChange={(event) =>
                      setName(
                          event.target.value,
                      )
                  }
                  onBlur={() =>
                      void saveName()
                  }
                  onKeyDown={(event) => {
                    if (
                        event.key ===
                        "Enter"
                    ) {
                      event
                          .currentTarget
                          .blur();
                    }
                  }}
                  placeholder="Nombre de la parcela"
                  disabled={
                    props.is_deleted
                  }
              />
            </label>

            <div className="field-grid">
              <label className="field">
                <span>
                  Grupo
                </span>

                <select
                    value={
                        props.group_id ??
                        ""
                    }
                    disabled={
                      props.is_deleted
                    }
                    onChange={(event) =>
                        void onUpdate({
                          group_id:
                          event.target
                              .value,
                        })
                    }
                >
                  <option value="">
                    Sin grupo
                  </option>

                  {groups.map(
                      (group) => (
                          <option
                              value={
                                group.id
                              }
                              key={
                                group.id
                              }
                          >
                            {group.name}
                          </option>
                      ),
                  )}
                </select>
              </label>

              <label className="field color-field">
                <span>
                  Color
                </span>

                <span className="color-control">
                  <input
                      type="color"
                      value={(
                          props.color ??
                          DEFAULT_PARCEL_COLOR
                      ).toLowerCase()}
                      disabled={
                        props.is_deleted
                      }
                      onChange={(event) =>
                          void onUpdate({
                            color:
                            event.target
                                .value,
                          })
                      }
                  />

                  <code>
                    {props.color ??
                        DEFAULT_PARCEL_COLOR}
                  </code>
                </span>
              </label>
            </div>

            <label className="field notes-field">
              <span>
                Notas del terreno
              </span>

              <textarea
                  value={notes}
                  onChange={(event) =>
                      setNotes(
                          event.target.value,
                      )
                  }
                  onBlur={() =>
                      void saveNotes()
                  }
                  placeholder="Accesos, muros, caminos, cultivo, observaciones…"
                  maxLength={4000}
                  disabled={
                    props.is_deleted
                  }
              />
            </label>
          </div>

          <ParcelUnitsEditor
              cadastralRef={
                props.cadastral_ref
              }
              isGuest={isGuest}
              isDeleted={
                props.is_deleted
              }
          />

          <div className="inspector-actions">
            <button
                type="button"
                className="secondary-button"
                onClick={onCenter}
            >
              <CrosshairIcon />
              Centrar
            </button>

            {props.is_deleted ? (
                <button
                    type="button"
                    className="restore-button"
                    onClick={() =>
                        void onUpdate({
                          is_deleted:
                              false,
                        })
                    }
                >
                  <RestoreIcon />
                  Restaurar
                </button>
            ) : (
                <button
                    type="button"
                    className="danger-button"
                    onClick={
                      deleteParcel
                    }
                >
                  <TrashIcon />
                  Borrar
                </button>
            )}
          </div>
        </section>

        {/* ===============================================================
          MOBILE
          =============================================================== */}
        <section className="parcel-detail-mobile">
          <header className="mobile-detail-header">
            <button
                type="button"
                className="mobile-detail-back"
                onClick={onClose}
                aria-label="Volver"
            >
              <BackIcon />
            </button>

            <strong>
              Detalle de parcela
            </strong>
          </header>

          <div
              className="mobile-map-slot"
              aria-label="Mapa de la parcela"
          />

          <div className="mobile-detail-body">
            <div className="mobile-detail-title-row">
              <div className="mobile-detail-title-copy">
                <input
                    className="mobile-detail-name"
                    value={name}
                    onChange={(event) =>
                        setName(
                            event.target.value,
                        )
                    }
                    onBlur={() =>
                        void saveName()
                    }
                    onKeyDown={(event) => {
                      if (
                          event.key ===
                          "Enter"
                      ) {
                        event
                            .currentTarget
                            .blur();
                      }
                    }}
                    placeholder="Sin nombre"
                    disabled={
                      props.is_deleted
                    }
                />

                <span className="mobile-detail-statusline">
                  {props.is_deleted
                      ? "Parcela archivada"
                      : "Parcela activa"}
                </span>

                <button
                    type="button"
                    className="mobile-detail-ref"
                    onClick={() =>
                        void copyReference()
                    }
                >
                  <span>
                    Referencia catastral
                  </span>

                  <code>
                    {props.cadastral_ref}
                  </code>

                  <CopyIcon />
                </button>
              </div>

              <label className="mobile-detail-group">
                <span
                    className="mobile-group-color"
                    style={{
                      background:
                          props.color ??
                          DEFAULT_PARCEL_COLOR,
                    }}
                />

                <select
                    value={
                        props.group_id ??
                        ""
                    }
                    disabled={
                      props.is_deleted
                    }
                    aria-label="Grupo"
                    onChange={(event) =>
                        void onUpdate({
                          group_id:
                          event.target
                              .value,
                        })
                    }
                >
                  <option value="">
                    Sin grupo
                  </option>

                  {groups.map(
                      (group) => (
                          <option
                              value={
                                group.id
                              }
                              key={
                                group.id
                              }
                          >
                            {group.name}
                          </option>
                      ),
                  )}
                </select>
              </label>
            </div>

            <div className="mobile-detail-metrics">
              <div>
                <span className="mobile-metric-icon">
                  <AreaIcon />
                </span>

                <span>
                  <small>
                    Superficie
                  </small>

                  <strong>
                    {props.area_m2 == null
                        ? "—"
                        : `${formatNumber(
                            props.area_m2,
                            0,
                        )} m²`}
                  </strong>

                  <em>
                    {formatHectares(
                        props.area_ha,
                    )}
                  </em>
                </span>
              </div>

              <div>
                <span className="mobile-metric-icon">
                  <RulerIcon />
                </span>

                <span>
                  <small>
                    Perímetro
                  </small>

                  <strong>
                    {formatDistance(
                        props.perimeter_m,
                    )}
                  </strong>

                  <em>
                    Contorno catastral
                  </em>
                </span>
              </div>
            </div>

            <div className="mobile-detail-info">
              <div>
                <span>
                  Grupo
                </span>

                <strong>
                  {groupName}
                </strong>
              </div>

              <div>
                <span>
                  Estado
                </span>

                <strong>
                  {props.is_deleted
                      ? "Borrada"
                      : "Activa"}
                </strong>
              </div>

              <div>
                <span>
                  Color
                </span>

                <label className="mobile-color-inline">
                  <input
                      type="color"
                      value={(
                          props.color ??
                          DEFAULT_PARCEL_COLOR
                      ).toLowerCase()}
                      disabled={
                        props.is_deleted
                      }
                      onChange={(event) =>
                          void onUpdate({
                            color:
                            event.target
                                .value,
                          })
                      }
                  />

                  <code>
                    {props.color ??
                        DEFAULT_PARCEL_COLOR}
                  </code>
                </label>
              </div>
            </div>

            <ParcelUnitsEditor
                cadastralRef={
                  props.cadastral_ref
                }
                isGuest={isGuest}
                isDeleted={
                  props.is_deleted
                }
            />

            <label className="mobile-detail-notes">
              <span className="mobile-notes-icon">
                <NoteIcon />
              </span>

              <span className="mobile-notes-copy">
                <strong>
                  Notas
                </strong>

                <textarea
                    value={notes}
                    onChange={(event) =>
                        setNotes(
                            event.target.value,
                        )
                    }
                    onBlur={() =>
                        void saveNotes()
                    }
                    placeholder="Añade accesos, cultivos, muros, caminos u observaciones…"
                    maxLength={4000}
                    disabled={
                      props.is_deleted
                    }
                />
              </span>
            </label>

            <div className="mobile-detail-actions">
              <button
                  type="button"
                  className="mobile-share-button"
                  onClick={() =>
                      void shareParcel()
                  }
              >
                <ShareIcon />

                {copied
                    ? "Copiado"
                    : "Compartir"}
              </button>

              <button
                  type="button"
                  className="mobile-map-button"
                  onClick={
                    openOnMap
                  }
              >
                <MapArrowIcon />
                Ver en mapa
              </button>
            </div>

            <div className="mobile-detail-danger">
              {props.is_deleted ? (
                  <button
                      type="button"
                      onClick={() =>
                          void onUpdate({
                            is_deleted:
                                false,
                          })
                      }
                  >
                    <RestoreIcon />
                    Restaurar parcela
                  </button>
              ) : (
                  <button
                      type="button"
                      onClick={
                        deleteParcel
                      }
                  >
                    <TrashIcon />
                    Mover a borradas
                  </button>
              )}
            </div>
          </div>
        </section>
      </>
  );
}
