"use client";

import { useEffect, useState } from "react";
import {
  CloseIcon,
  CopyIcon,
  CrosshairIcon,
  RestoreIcon,
  RulerIcon,
  TrashIcon,
} from "@/components/ui/Icons";
import { formatDistance, formatHectares, formatNumber } from "@/lib/format";
import { DEFAULT_PARCEL_COLOR } from "@/lib/map";
import type { ParcelFeature, ParcelGroup, ParcelUpdate } from "@/types/cadastre";

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
  onUpdate: (update: ParcelUpdate) => Promise<unknown>;
  onDelete: () => Promise<unknown>;
}) {
  const props = parcel.properties;
  const [name, setName] = useState(props.name ?? "");
  const [notes, setNotes] = useState(props.notes ?? "");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setName(props.name ?? "");
    setNotes(props.notes ?? "");
  }, [props.cadastral_ref, props.name, props.notes]);

  const saveName = async () => {
    const next = name.trim();
    if (next === (props.name ?? "")) return;
    await onUpdate({ name: next });
  };

  const saveNotes = async () => {
    const next = notes.trim();
    if (next === (props.notes ?? "")) return;
    await onUpdate({ notes: next });
  };

  const copyReference = async () => {
    await navigator.clipboard.writeText(props.cadastral_ref);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="parcel-inspector">
      <div className="inspector-heading">
        <div>
          <span className="eyebrow">Parcela seleccionada</span>
          <h2>{props.name?.trim() || "Sin nombre"}</h2>
        </div>
        <button className="close-inspector" type="button" onClick={onClose} aria-label="Cerrar detalle">
          <CloseIcon />
        </button>
      </div>

      <button className="inspector-ref" type="button" onClick={() => void copyReference()} title="Copiar referencia">
        <code>{props.cadastral_ref}</code>
        <span>{copied ? "Copiada" : <CopyIcon />}</span>
      </button>

      <div className="parcel-metrics">
        <div className="metric-card metric-primary">
          <span>Superficie</span>
          <strong>{formatHectares(props.area_ha)}</strong>
          <small>{props.area_m2 == null ? "—" : `${formatNumber(props.area_m2, 0)} m²`}</small>
        </div>
        <div className="metric-card">
          <span>Perímetro</span>
          <strong><RulerIcon /> {formatDistance(props.perimeter_m)}</strong>
          <small>contorno catastral</small>
        </div>
      </div>

      <div className="inspector-fields">
        <label className="field">
          <span>Nombre</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => void saveName()}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            placeholder="Nombre de la parcela"
            disabled={props.is_deleted}
          />
        </label>

        <div className="field-grid">
          <label className="field">
            <span>Grupo</span>
            <select
              value={props.group_id ?? ""}
              disabled={props.is_deleted}
              onChange={(event) => void onUpdate({ group_id: event.target.value })}
            >
              <option value="">Sin grupo</option>
              {groups.map((group) => (
                <option value={group.id} key={group.id}>{group.name}</option>
              ))}
            </select>
          </label>

          <label className="field color-field">
            <span>Color</span>
            <span className="color-control">
              <input
                type="color"
                value={(props.color ?? DEFAULT_PARCEL_COLOR).toLowerCase()}
                disabled={props.is_deleted}
                onChange={(event) => void onUpdate({ color: event.target.value })}
              />
              <code>{props.color ?? DEFAULT_PARCEL_COLOR}</code>
            </span>
          </label>
        </div>

        <label className="field notes-field">
          <span>Notas del terreno</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => void saveNotes()}
            placeholder="Accesos, muros, caminos, cultivo, observaciones…"
            maxLength={4000}
            disabled={props.is_deleted}
          />
        </label>
      </div>

      <div className="inspector-actions">
        <button type="button" className="secondary-button" onClick={onCenter}>
          <CrosshairIcon /> Centrar
        </button>

        {props.is_deleted ? (
          <button type="button" className="restore-button" onClick={() => void onUpdate({ is_deleted: false })}>
            <RestoreIcon /> Restaurar
          </button>
        ) : (
          <button
            type="button"
            className="danger-button"
            onClick={() => {
              if (window.confirm("¿Mover esta parcela a borradas?")) void onDelete();
            }}
          >
            <TrashIcon /> Borrar
          </button>
        )}
      </div>
    </section>
  );
}
