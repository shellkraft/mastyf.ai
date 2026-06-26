/** UUID v4-ish org id — matches organizations.id TEXT primary keys. */
const ORG_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidOrgId(orgId: string): boolean {
  return ORG_ID_RE.test(orgId.trim());
}

export function recentPackagesReportLimit(): number {
  const raw = process.env.MASTYF_AI_REPORT_RECENT_PACKAGES_LIMIT;
  const n = raw ? parseInt(raw, 10) : 10;
  if (!Number.isFinite(n) || n < 1) return 10;
  return Math.min(n, 100);
}
