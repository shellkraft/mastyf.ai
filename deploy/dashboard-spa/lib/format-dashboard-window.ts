/** Matches DashboardWindow in DashboardWindowContext.tsx */
export type DashboardWindowLabel = '1h' | '12h' | '24h' | '7d' | '30d' | '90d';

const WINDOW_SHORT: Record<DashboardWindowLabel, string> = {
  '1h': '1h',
  '12h': '12h',
  '24h': '24h',
  '7d': '7d',
  '30d': '30d',
  '90d': '90d',
};

const VALID_WINDOWS = new Set<string>(Object.keys(WINDOW_SHORT));

/** Map fractional day counts back to the nearest dashboard window label. */
export function daysToWindowLabel(days: number): DashboardWindowLabel {
  if (days <= 1 / 24 + 1e-9) return '1h';
  if (days <= 12 / 24 + 1e-9) return '12h';
  if (days <= 1 + 1e-9) return '24h';
  if (days <= 7 + 1e-9) return '7d';
  if (days <= 30 + 1e-9) return '30d';
  return '90d';
}

/** API query value — always a label like `1h` or `7d`, never a fractional day count. */
export function toWindowQueryParam(
  window: DashboardWindowLabel | string | number | null | undefined,
): string {
  if (window == null || window === '') return '7d';
  if (typeof window === 'string' && VALID_WINDOWS.has(window)) return window;
  if (typeof window === 'number' && Number.isFinite(window)) return daysToWindowLabel(window);
  return String(window);
}

/** Filename suffix for window-scoped downloads (e.g. `7d`, `1h`). */
export function formatDownloadWindowSuffix(
  window: DashboardWindowLabel | string | number | null | undefined,
): string {
  return toWindowQueryParam(window);
}

/** Short label for picker / KPI subtitles (e.g. "1h", "7d"). */
export function formatDashboardWindowLabel(window: DashboardWindowLabel): string {
  return WINDOW_SHORT[window] ?? window;
}

/**
 * KPI subtitle like "1h window" or "7d window".
 * Accepts dashboard window labels or fractional day counts from APIs.
 */
export function formatWindowSubtitle(window: DashboardWindowLabel | string | number | null | undefined): string {
  if (window == null || window === '') return '7d window';

  if (typeof window === 'string' && VALID_WINDOWS.has(window)) {
    return `${WINDOW_SHORT[window as DashboardWindowLabel]} window`;
  }

  if (typeof window === 'number' && Number.isFinite(window)) {
    if (window < 1) {
      const hours = Math.round(window * 24);
      return hours <= 1 ? '1h window' : `${hours}h window`;
    }
    const days = Number.isInteger(window) ? window : Math.round(window * 10) / 10;
    return `${days}d window`;
  }

  if (typeof window === 'string') {
    return window.includes('window') ? window : `${window} window`;
  }

  return '7d window';
}
