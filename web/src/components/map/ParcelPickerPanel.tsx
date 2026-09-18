"use client";

import {
    CloseIcon,
    MapPinIcon,
    PlusIcon,
} from "@/components/ui/Icons";
import type {
    CadastralUnit,
    ParcelFeature,
} from "@/types/cadastre";

export function ParcelPickerPanel({
                                      active,
                                      loading,
                                      preview,
                                      units,
                                      selectedUnitRefs,
                                      alreadySaved,
                                      onStart,
                                      onCancel,
                                      onSave,
                                      onOpenSaved,
                                      onToggleUnit,
                                      onToggleAllUnits,
                                  }: {
    active: boolean;
    loading: boolean;
    preview: ParcelFeature | null;
    units: CadastralUnit[];
    selectedUnitRefs: string[];
    alreadySaved: boolean;
    onStart: () => void;
    onCancel: () => void;
    onSave: () => void;
    onOpenSaved: () => void;
    onToggleUnit: (cadastralRef: string) => void;
    onToggleAllUnits: () => void;
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

    const allSelected =
        units.length > 0 &&
        selectedUnitRefs.length === units.length;

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

            {units.length > 0 ? (
                <div className="picker-units">
                    <div className="picker-units-head">
                        <div>
                            <strong>
                                {units.length === 1
                                    ? "1 inmueble asociado"
                                    : `${units.length} inmuebles asociados`}
                            </strong>

                            <span>
                                Selecciona los inmuebles que quieres guardar
                            </span>
                        </div>

                        {units.length > 1 ? (
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={onToggleAllUnits}
                                disabled={loading}
                            >
                                {allSelected
                                    ? "Deseleccionar todos"
                                    : "Seleccionar todos"}
                            </button>
                        ) : null}
                    </div>

                    <div className="picker-units-list">
                        {units.map((unit) => {
                            const checked =
                                selectedUnitRefs.includes(
                                    unit.cadastral_ref,
                                );

                            return (
                                <label
                                    key={unit.cadastral_ref}
                                    className="picker-unit"
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        disabled={loading}
                                        onChange={() =>
                                            onToggleUnit(
                                                unit.cadastral_ref,
                                            )
                                        }
                                    />

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

                                        {unit.address ? (
                                            <span>
                                                {unit.address}
                                            </span>
                                        ) : null}
                                    </div>

                                    {unit.built_area_m2 != null ? (
                                        <span className="picker-unit-area">
                                            {unit.built_area_m2} m²
                                        </span>
                                    ) : null}
                                </label>
                            );
                        })}
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
