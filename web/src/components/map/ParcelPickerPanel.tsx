"use client";

import { CloseIcon, MapPinIcon, PlusIcon } from "@/components/ui/Icons";
import type { ParcelFeature } from "@/types/cadastre";

export function ParcelPickerPanel({
  active,
  loading,
  preview,
  alreadySaved,
  onStart,
  onCancel,
  onSave,
  onOpenSaved,
}: {
  active: boolean;
  loading: boolean;
  preview: ParcelFeature | null;
  alreadySaved: boolean;
  onStart: () => void;
  onCancel: () => void;
  onSave: () => void;
  onOpenSaved: () => void;
}) {
  if (!active) {
    return (
      <button type="button" className="map-action map-add-action" onClick={onStart}>
        <MapPinIcon /> Añadir desde mapa
      </button>
    );
  }

  if (!preview) {
    return (
      <div className="parcel-picker-banner" role="status">
        <span className="picker-symbol"><MapPinIcon /></span>
        <div>
          <strong>{loading ? "Identificando parcela…" : "Selecciona una parcela"}</strong>
          <span>
            {loading
              ? "Consultando el Catastro oficial"
              : "Haz clic dentro del terreno que quieres guardar"}
          </span>
        </div>
        <button type="button" className="picker-close" onClick={onCancel} aria-label="Salir del modo de selección">
          <CloseIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="parcel-picker-card">
      <div className="picker-card-head">
        <span className="picker-symbol"><MapPinIcon /></span>
        <div>
          <span className="eyebrow">Parcela encontrada</span>
          <strong>{preview.properties.cadastral_ref}</strong>
        </div>
        <button type="button" className="picker-close" onClick={onCancel} aria-label="Cancelar selección">
          <CloseIcon />
        </button>
      </div>

      <p>
        {alreadySaved
          ? "Esta parcela ya está guardada en Catastro Digital."
          : "Comprueba el contorno resaltado antes de guardarla."}
      </p>

      <div className="picker-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="primary-button picker-primary"
          onClick={alreadySaved ? onOpenSaved : onSave}
          disabled={loading}
        >
          {alreadySaved ? <MapPinIcon /> : <PlusIcon />}
          {alreadySaved ? "Abrir parcela" : loading ? "Guardando…" : "Guardar parcela"}
        </button>
      </div>
    </div>
  );
}
