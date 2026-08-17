export function formatArea(areaM2: number | null | undefined): string {
  if (areaM2 == null || !Number.isFinite(areaM2)) return "—";
  if (areaM2 >= 10_000) return `${formatNumber(areaM2 / 10_000, areaM2 >= 100_000 ? 1 : 2)} ha`;
  return `${formatNumber(areaM2, 0)} m²`;
}

export function formatHectares(areaHa: number | null | undefined): string {
  if (areaHa == null || !Number.isFinite(areaHa)) return "—";
  return `${formatNumber(areaHa, areaHa >= 10 ? 1 : 2)} ha`;
}

export function formatDistance(metres: number | null | undefined): string {
  if (metres == null || !Number.isFinite(metres)) return "—";
  if (metres >= 1000) return `${formatNumber(metres / 1000, metres >= 10_000 ? 0 : 2)} km`;
  if (metres >= 100) return `${formatNumber(metres, 0)} m`;
  return `${formatNumber(metres, 1)} m`;
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("es-ES", {
    maximumFractionDigits,
  }).format(value);
}
