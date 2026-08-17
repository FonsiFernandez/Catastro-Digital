"use client";

import { LayersIcon } from "@/components/ui/Icons";
import type { BaseMapId } from "@/types/cadastre";

function Switch({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  detail: string;
}) {
  return (
    <label className="switch-row">
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <span className="switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="switch-track" />
      </span>
    </label>
  );
}

export function LayerControls({
  baseMap,
  onBaseMap,
  showCatastro,
  onShowCatastro,
  includeDeleted,
  onIncludeDeleted,
}: {
  baseMap: BaseMapId;
  onBaseMap: (value: BaseMapId) => void;
  showCatastro: boolean;
  onShowCatastro: (checked: boolean) => void;
  includeDeleted: boolean;
  onIncludeDeleted: (checked: boolean) => void;
}) {
  return (
    <section className="quick-controls">
      <div className="control-title">
        <LayersIcon />
        <span>Mapa y visualización</span>
      </div>

      <label className="base-map-field">
        <span>Vista base</span>
        <select value={baseMap} onChange={(event) => onBaseMap(event.target.value as BaseMapId)}>
          <option value="street">Mapa · OpenStreetMap</option>
          <option value="aerial">Ortofoto · PNOA máxima actualidad</option>
          <option value="topographic">Topográfico · IGN</option>
        </select>
        <small>La ortofoto PNOA ofrece fotografía aérea oficial de España.</small>
      </label>

      <div className="toggle-grid">
        <Switch
          checked={showCatastro}
          onChange={onShowCatastro}
          label="Catastro"
          detail="Límites oficiales"
        />
        <Switch
          checked={includeDeleted}
          onChange={onIncludeDeleted}
          label="Borradas"
          detail="Mostrar historial"
        />
      </div>
    </section>
  );
}
