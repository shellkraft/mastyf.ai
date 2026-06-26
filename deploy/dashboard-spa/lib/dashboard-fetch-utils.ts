/** True when a dashboard API envelope indicates live data is unavailable. */
export function isApiDataUnavailable(
  payload: { available?: boolean; error?: string; emptyReason?: string } | null | undefined,
): boolean {
  if (!payload) return true;
  return payload.available === false;
}

/** User-facing KPI value when data is unavailable vs empty-but-valid. */
export function unavailableKpiValue(
  payload: { available?: boolean; error?: string; emptyReason?: string } | null | undefined,
  value: string | number,
): string {
  if (isApiDataUnavailable(payload)) return '—';
  if (payload?.emptyReason && value === 0) return '0';
  return typeof value === 'number' ? value.toLocaleString() : value;
}

/** Secondary line for KPI when API failed or returned emptyReason. */
export function unavailableKpiSecondary(
  payload: { available?: boolean; error?: string; emptyReason?: string } | null | undefined,
  fallback: string,
): string {
  if (!payload) return 'API unavailable';
  if (payload.available === false) return payload.error || 'API unavailable';
  if (payload.emptyReason) return payload.emptyReason;
  return fallback;
}
