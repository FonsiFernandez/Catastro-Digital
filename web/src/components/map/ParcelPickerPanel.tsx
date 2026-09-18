"use client";

import {
    CloseIcon,
    MapPinIcon,
    PlusIcon,
} from "@/components/ui/Icons";
import type {CadastralUnit, ParcelFeature} from "@/types/cadastre";

export function ParcelPickerPanel({
                                      active,
                                      loading,
                                      preview,
                                      units,
                                      alreadySaved,
                                      onStart,
                                      onCancel,
                                      onSave,
                                      onOpenSaved,
                                  }: {
    active: boolean;
    loading: boolean;
    preview: ParcelFeature | null;
    units: CadastralUnit[];
    alreadySaved: boolean;
    onStart: () => void;
    onCancel: () => void;
    onSave: () => void;
    onOpenSaved: () => void;
}) {
    if (!active) {
        return (
            <button
                type="button"
                className="map-action map-add-action"
                onClick={onStart}
            >
                <MapPinIcon />
                Añadir desde mapa
            </button>
        );
    }

    if (!preview) {
        return (
            <div
                className="parcel-picker-banner"
                role="status"
                aria-live="polite"
                aria-busy={loading}
            >
        <span className="picker-symbol">
          <MapPinIcon />
        </span>

                <div>
                    <strong>
                        {loading
                            ? "Identificando parcela…"
                            : "Selecciona una parcela"}
                    </strong>

                    <span>
            {loading
                ? "Consultando la información catastral oficial. Puede tardar unos segundos."
                : "Haz clic o toca dentro del terreno que quieres consultar."}
          </span>
                </div>

                <button
                    type="button"
                    className="picker-close"
                    onClick={onCancel}
                    aria-label={
                        loading
                            ? "Cancelar consulta"
                            : "Cerrar selección"
                    }
                >
                    <CloseIcon />
                </button>
            </div>
        );
    }

    return (
        <div
            className="parcel-picker-card"
            aria-busy={loading}
        >
            <div className="picker-card-head">
        <span className="picker-symbol">
          <MapPinIcon />
        </span>

                <div>
          <span className="eyebrow">
            {alreadySaved
                ? "Parcela guardada"
                : "Parcela encontrada"}
          </span>

                    <strong>
                        {preview.properties.cadastral_ref}
                    </strong>
                </div>

                <button
                    type="button"
                    className="picker-close"
                    onClick={onCancel}
                    aria-label="Cerrar"
                    disabled={loading}
                >
                    <CloseIcon />
                </button>
            </div>

            <p>
                {alreadySaved
                    ? "Esta parcela ya está guardada en Catastro Digital."
                    : "Comprueba el contorno resaltado antes de guardarla."}
            </p>

            {units.length > 1 ? (
                <div className="picker-units">
                    <div className="picker-units-head">
                        <strong>
                            {units.length} inmuebles en esta parcela
                        </strong>

                        <span>
                Referencias catastrales asociadas
            </span>
                    </div>

                    <div className="picker-units-list">
                        {units.map((unit) => (
                            <div
                                key={unit.cadastral_ref}
                                className="picker-unit"
                            >
                                <div>
                                    <strong>
                                        {unit.floor || unit.door
                                            ? [
                                                unit.floor
                                                    ? `Planta ${unit.floor}`
                                                    : null,
                                                unit.door
                                                    ? `Puerta ${unit.door}`
                                                    : null,
                                            ]
                                                .filter(Boolean)
                                                .join(" · ")
                                            : unit.use ?? "Inmueble"}
                                    </strong>

                                    <span>
                            {unit.cadastral_ref}
                        </span>
                                </div>

                                {unit.built_area_m2 != null ? (
                                    <span className="picker-unit-area">
                            {unit.built_area_m2} m²
                        </span>
                                ) : null}
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="picker-actions">
                <button
                    type="button"
                    className="secondary-button"
                    onClick={onCancel}
                    disabled={loading}
                >
                    Cancelar
                </button>

                <button
                    type="button"
                    className="primary-button picker-primary"
                    onClick={
                        alreadySaved
                            ? onOpenSaved
                            : onSave
                    }
                    disabled={loading}
                >
                    {alreadySaved ? (
                        <MapPinIcon />
                    ) : (
                        <PlusIcon />
                    )}

                    {alreadySaved
                        ? "Abrir parcela"
                        : loading
                            ? "Guardando…"
                            : "Guardar parcela"}
                </button>
            </div>
        </div>
    );
}
