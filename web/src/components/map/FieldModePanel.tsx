"use client";

import { CrosshairIcon, LandIcon, LocationIcon } from "@/components/ui/Icons";
import { formatDistance, formatHectares } from "@/lib/format";
import type { DeviceLocation, FieldTarget } from "@/types/cadastre";
import type { FieldLocationStatus } from "@/hooks/useFieldLocation";

export function FieldModePanel({
  active,
  status,
  location,
  target,
  error,
  lockedToSelection,
  onStart,
  onStop,
  onCenterUser,
  onCenterParcel,
  onUseDetectedParcel,
  onAutoDetect,
}: {
  active: boolean;
  status: FieldLocationStatus;
  location: DeviceLocation | null;
  target: FieldTarget | null;
  error: string | null;
  lockedToSelection: boolean;
  onStart: () => void;
  onStop: () => void;
  onCenterUser: () => void;
  onCenterParcel: () => void;
  onUseDetectedParcel: () => void;
  onAutoDetect: () => void;
}) {
  if (!active) {
    return (
      <button type="button" className="map-action field-mode-trigger" onClick={onStart}>
        <LocationIcon /> Modo campo
      </button>
    );
  }

  const uncertaintyDominates = Boolean(
    location && target && location.accuracy > target.boundary_distance_m,
  );

  return (
    <section className="field-panel" aria-live="polite">
      <div className="field-panel-head">
        <div className="field-title-block">
          <span className="field-kicker">Modo campo</span>
          <strong>{status === "requesting" ? "Buscando tu posición…" : "Seguimiento GPS"}</strong>
        </div>
        <button type="button" className="small-ghost-button" onClick={onStop}>Salir</button>
      </div>

      {error ? <div className="field-error">{error}</div> : null}

      {location ? (
        <div className="field-gps-row">
          <span className="field-gps-dot" />
          <span>GPS ±{Math.round(location.accuracy)} m</span>
          {location.speed != null && location.speed > 0.5 ? (
            <span>{Math.round(location.speed * 3.6)} km/h</span>
          ) : null}
        </div>
      ) : null}

      {target ? (
        <>
          <div className="field-target-card">
            <div className="field-target-icon"><LandIcon /></div>
            <div className="field-target-main">
              <span>{lockedToSelection ? "Finca seleccionada" : "Finca detectada"}</span>
              <strong>{target.parcel.properties.name?.trim() || target.parcel.properties.cadastral_ref}</strong>
              <small>
                {formatHectares(target.parcel.properties.area_ha)}
                {target.group_name ? ` · ${target.group_name}` : ""}
              </small>
            </div>
            <div className={target.inside ? "field-state is-inside" : "field-state is-outside"}>
              {target.inside ? "Dentro" : "Fuera"}
            </div>
          </div>

          <div className="field-distance-card">
            <span>{target.inside ? "Límite más cercano" : "Distancia al límite"}</span>
            <strong>{formatDistance(target.boundary_distance_m)}</strong>
            {uncertaintyDominates ? (
              <small>La precisión GPS actual es mayor que esta distancia.</small>
            ) : (
              <small>Posición orientativa; no sustituye una medición topográfica.</small>
            )}
          </div>

          <div className="field-actions">
            <button type="button" className="secondary-button" onClick={onCenterUser}>
              <LocationIcon /> Centrarme
            </button>
            <button type="button" className="secondary-button" onClick={onCenterParcel}>
              <CrosshairIcon /> Ver finca
            </button>
            {lockedToSelection ? (
              <button type="button" className="field-link-button" onClick={onAutoDetect}>
                Detectar donde estoy
              </button>
            ) : (
              <button type="button" className="field-link-button" onClick={onUseDetectedParcel}>
                Seleccionar esta finca
              </button>
            )}
          </div>
        </>
      ) : location && !error ? (
        <div className="field-empty">
          <strong>No hay una finca guardada cerca.</strong>
          <span>Guarda primero la parcela o selecciona una de tu biblioteca.</span>
        </div>
      ) : null}
    </section>
  );
}
