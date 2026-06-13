import { createHmac, timingSafeEqual } from 'crypto';
import type { DashboardRole } from '../auth/dashboard-rbac.js';

export type CloudSessionPayload = {
  tenantSlug: string;
  identity: string;
  roles: string[];
  exp: number;
};

export function verifyCloudSessionToken(token: string): CloudSessionPayload | null {
  const secret =
    process.env['MASTYFF_AI_CLOUD_JWT_SECRET'] ??
    process.env['LICENSE_JWT_SECRET'] ??
    process.env['DASHBOARD_JWT_SECRET'];
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = createHmac('sha256', secret).update(encoded!).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(sig!), Buffer.from(expected))) return null;
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded!, 'base64url').toString('utf8'),
    ) as CloudSessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.tenantSlug || !payload.identity) return null;
    return payload;
  } catch {
    return null;
  }
}

export function mapCloudRoles(roles: string[]): DashboardRole[] {
  const allowed = new Set<DashboardRole>([
    'viewer',
    'analyst',
    'operator',
    'admin',
    'tenant-admin',
  ]);
  const mapped = roles.filter((r): r is DashboardRole => allowed.has(r as DashboardRole));
  return mapped.length > 0 ? mapped : ['tenant-admin'];
}
