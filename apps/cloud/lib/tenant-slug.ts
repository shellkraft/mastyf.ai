const TENANT_ID_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$/;
export const MAX_TENANT_ID_LENGTH = 64;

export class InvalidTenantSlugError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTenantSlugError';
  }
}

/** Validate slug matches Mastyff AI tenant_id rules. */
export function validateTenantSlug(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new InvalidTenantSlugError('Tenant slug must not be empty');
  }
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new InvalidTenantSlugError('Tenant slug must not contain path traversal sequences');
  }
  if (trimmed.length > MAX_TENANT_ID_LENGTH) {
    throw new InvalidTenantSlugError(`Tenant slug exceeds max length of ${MAX_TENANT_ID_LENGTH}`);
  }
  if (!TENANT_ID_PATTERN.test(trimmed)) {
    throw new InvalidTenantSlugError(
      'Tenant slug must be alphanumeric with optional internal hyphens',
    );
  }
  return trimmed;
}

/** Derive a unique tenant slug from email or name. */
export function suggestTenantSlug(email: string, name?: string | null): string {
  const local = email.split('@')[0] ?? 'org';
  const baseRaw = (name ?? local)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  const base = baseRaw || 'org';
  const suffix = Math.random().toString(36).slice(2, 8);
  const candidate = `${base}-${suffix}`.slice(0, MAX_TENANT_ID_LENGTH);
  return validateTenantSlug(candidate);
}

/** Append numeric suffix until unique (caller checks DB). */
export function withSlugSuffix(base: string, n: number): string {
  const suffix = n > 0 ? `-${n}` : '';
  const trimmed = `${base}${suffix}`.slice(0, MAX_TENANT_ID_LENGTH);
  return validateTenantSlug(trimmed);
}
