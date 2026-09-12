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
  formatDistance,
  formatHectares,
  formatNumber,
} from "@/lib/format";
import { DEFAULT_PARCEL_COLOR } from "@/lib/map";
import type {
  ParcelFeature,
  ParcelGroup,
  ParcelUpdate,
} from "@/types/cadastre";

type LonLat = [number, number];

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

function getPolygonRings(
    parcel: ParcelFeature,
): LonLat[][] {
  if (parcel.geometry.type === "Polygon") {
    return parcel.geometry.coordinates as LonLat[][];
  }

  if (parcel.geometry.type === "MultiPolygon") {
    return (
        parcel.geometry.coordinates[0] as LonLat[][]
    );
  }

  return [];
}

function parcelPreviewPath(
    parcel: ParcelFeature,
): string | null {
  const rings = getPolygonRings(parcel);
  const ring = rings[0];

  if (!ring || ring.length < 3) {
    return null;
  }

  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const width = Math.max(maxX - minX, 0.000001);
  const height = Math.max(maxY - minY, 0.000001);

  const padding = 16;
  const viewWidth = 320;
  const viewHeight = 150;

  const scale = Math.min(
      (viewWidth - padding * 2) / width,
      (viewHeight - padding * 2) / height,
  );

  const offsetX =
      (viewWidth - width * scale) / 2;
  const offsetY =
      (viewHeight - height * scale) / 2;

  return ring
      .map(([x, y], index) => {
        const px =
            offsetX + (x - minX) * scale;
        const py =
            viewHeight -
            (offsetY + (y - minY) * scale);

        return `${index === 0 ? "M" : "L"} ${px.toFixed(2)} ${py.toFixed(2)}`;
      })
      .join(" ") + " Z";
}

export function ParcelInspector({
                                  parcel,
                                  groups,
                                  onClose,
                                  onCenter,
                                  onUpdate,
                                  onDelete,
                                }: {
  parcel: ParcelFeature;
  groups: ParcelGroup[];
  onClose: () => void;
  onCenter: () => void;
  onUpdate: (
      update: ParcelUpdate,
  ) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const props = parcel.properties;

  const [name, setName] =
      useState(props.name ?? "");

  const [notes, setNotes] =
      useState(props.notes ?? "");

  const [copied, setCopied] =
      useState(false);

  const previewPath = useMemo(
      () => parcelPreviewPath(parcel),
      [parcel],
  );

  const groupName =
      groups.find(
          (group) =>
              group.id === props.group_id,
      )?.name ?? "Sin grupo";

  useEffect(() => {
    setName(props.name ?? "");
    setNotes(props.notes ?? "");
  }, [
    props.cadastral_ref,
    props.name,
    props.notes,
  ]);

  const saveName = async () => {
    const next = name.trim();

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

  const saveNotes = async () => {
    const next = notes.trim();

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

  const copyReference = async () => {
    await navigator.clipboard.writeText(
        props.cadastral_ref,
    );

    setCopied(true);

    window.setTimeout(
        () => setCopied(false),
        1500,
    );
  };

  const shareParcel = async () => {
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
            error instanceof DOMException &&
            error.name === "AbortError"
        ) {
          return;
        }
      }
    }

    await navigator.clipboard.writeText(
        text,
    );

    setCopied(true);

    window.setTimeout(
        () => setCopied(false),
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
          DESKTOP — existing inspector preserved
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
            {copied ? (
                "Copiada"
            ) : (
                <CopyIcon />
            )}
          </span>
          </button>

          <div className="parcel-metrics">
            <div className="metric-card metric-primary">
              <span>Superficie</span>
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
              <span>Perímetro</span>
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
              <span>Nombre</span>
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
                        event.key === "Enter"
                    ) {
                      event.currentTarget.blur();
                    }
                  }}
                  placeholder="Nombre de la parcela"
                  disabled={props.is_deleted}
              />
            </label>

            <div className="field-grid">
              <label className="field">
                <span>Grupo</span>
                <select
                    value={
                        props.group_id ?? ""
                    }
                    disabled={
                      props.is_deleted
                    }
                    onChange={(event) =>
                        void onUpdate({
                          group_id:
                          event.target.value,
                        })
                    }
                >
                  <option value="">
                    Sin grupo
                  </option>

                  {groups.map(
                      (group) => (
                          <option
                              value={group.id}
                              key={group.id}
                          >
                            {group.name}
                          </option>
                      ),
                  )}
                </select>
              </label>

              <label className="field color-field">
                <span>Color</span>

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
                          event.target.value,
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
                          is_deleted: false,
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
                    onClick={deleteParcel}
                >
                  <TrashIcon />
                  Borrar
                </button>
            )}
          </div>
        </section>

        {/* ===============================================================
          MOBILE — mockup-inspired parcel detail
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

            <button
                type="button"
                className="mobile-detail-more"
                onClick={() =>
                    void copyReference()
                }
                aria-label="Copiar referencia"
                title="Copiar referencia"
            >
              <span>•••</span>
            </button>
          </header>

          <div className="mobile-parcel-preview">
            <svg
                viewBox="0 0 320 150"
                role="img"
                aria-label="Contorno de la parcela"
            >
              <defs>
                <pattern
                    id={`parcel-grid-${props.cadastral_ref}`}
                    width="24"
                    height="24"
                    patternUnits="userSpaceOnUse"
                >
                  <path
                      d="M24 0H0V24"
                      fill="none"
                      stroke="rgba(255,255,255,.18)"
                      strokeWidth="1"
                  />
                </pattern>
              </defs>

              <rect
                  width="320"
                  height="150"
                  fill="#7f9276"
              />

              <rect
                  width="320"
                  height="150"
                  fill={`url(#parcel-grid-${props.cadastral_ref})`}
              />

              <path
                  d="M-10 128 C55 96, 92 121, 146 91 S242 82, 330 31"
                  fill="none"
                  stroke="rgba(244,241,232,.7)"
                  strokeWidth="9"
              />

              <path
                  d="M20 16 C72 34, 105 15, 161 38 S260 49, 330 19"
                  fill="none"
                  stroke="rgba(64,82,62,.35)"
                  strokeWidth="4"
              />

              {previewPath ? (
                  <path
                      d={previewPath}
                      fill={
                          props.color ??
                          DEFAULT_PARCEL_COLOR
                      }
                      fillOpacity="0.65"
                      stroke="#fffaf2"
                      strokeWidth="5"
                      strokeLinejoin="round"
                  />
              ) : null}

              {previewPath ? (
                  <path
                      d={previewPath}
                      fill="none"
                      stroke={
                          props.color ??
                          DEFAULT_PARCEL_COLOR
                      }
                      strokeWidth="2"
                      strokeLinejoin="round"
                  />
              ) : null}
            </svg>

            <button
                type="button"
                className="mobile-preview-open-map"
                onClick={openOnMap}
                aria-label="Ver parcela en mapa"
            >
              <CrosshairIcon />
            </button>
          </div>

          <div className="mobile-detail-body">
            <div className="mobile-detail-title-row">
              <div>
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
                          event.key === "Enter"
                      ) {
                        event.currentTarget.blur();
                      }
                    }}
                    placeholder="Sin nombre"
                    disabled={
                      props.is_deleted
                    }
                />

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
                        props.group_id ?? ""
                    }
                    disabled={
                      props.is_deleted
                    }
                    aria-label="Grupo"
                    onChange={(event) =>
                        void onUpdate({
                          group_id:
                          event.target.value,
                        })
                    }
                >
                  <option value="">
                    Sin grupo
                  </option>

                  {groups.map(
                      (group) => (
                          <option
                              value={group.id}
                              key={group.id}
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
                <span>Grupo</span>
                <strong>
                  {groupName}
                </strong>
              </div>

              <div>
                <span>Estado</span>
                <strong>
                  {props.is_deleted
                      ? "Borrada"
                      : "Activa"}
                </strong>
              </div>

              <div>
                <span>Color</span>

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
                            event.target.value,
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

            <label className="mobile-detail-notes">
            <span className="mobile-notes-icon">
              <NoteIcon />
            </span>

              <span className="mobile-notes-copy">
              <strong>Notas</strong>

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
                  placeholder="Añade accesos, cultivos, muros u observaciones…"
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
                  onClick={openOnMap}
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
                            is_deleted: false,
                          })
                      }
                  >
                    <RestoreIcon />
                    Restaurar parcela
                  </button>
              ) : (
                  <button
                      type="button"
                      onClick={deleteParcel}
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
