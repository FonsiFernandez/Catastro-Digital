"use client";

import { LandIcon, RulerIcon } from "@/components/ui/Icons";
import { formatDistance, formatHectares } from "@/lib/format";
import type { ParcelFeature, ParcelGroup } from "@/types/cadastre";

export function LandSummary({ parcels, groups }: { parcels: ParcelFeature[]; groups: ParcelGroup[] }) {
  const active = parcels.filter((parcel) => !parcel.properties.is_deleted);
  const areaHa = active.reduce((total, parcel) => total + (parcel.properties.area_ha ?? 0), 0);
  const perimeterM = active.reduce((total, parcel) => total + (parcel.properties.perimeter_m ?? 0), 0);

  return (
    <section className="land-summary">
      <div className="land-summary-head">
        <span className="land-summary-icon"><LandIcon /></span>
        <div>
          <span className="eyebrow">Terrenos guardados</span>
          <strong>{formatHectares(areaHa)}</strong>
        </div>
      </div>
      <div className="land-summary-stats">
        <span><b>{active.length}</b> {active.length === 1 ? "parcela" : "parcelas"}</span>
        <span><b>{groups.length}</b> {groups.length === 1 ? "grupo" : "grupos"}</span>
        <span title="Suma de los perímetros individuales"><RulerIcon /> Σ {formatDistance(perimeterM)}</span>
      </div>
    </section>
  );
}
