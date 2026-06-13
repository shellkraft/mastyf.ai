import { describe, expect, it } from 'vitest';
import {
  InvalidTenantSlugError,
  suggestTenantSlug,
  validateTenantSlug,
  withSlugSuffix,
} from '../lib/tenant-slug';

describe('tenant-slug', () => {
  it('validates mastyff-ai-compatible slugs', () => {
    expect(validateTenantSlug('acme-corp')).toBe('acme-corp');
    expect(() => validateTenantSlug('../bad')).toThrow(InvalidTenantSlugError);
    expect(() => validateTenantSlug('')).toThrow(InvalidTenantSlugError);
  });

  it('suggests slug from email', () => {
    const slug = suggestTenantSlug('user@example.com', 'Acme Corp');
    expect(slug).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/i);
    expect(slug.length).toBeLessThanOrEqual(64);
  });

  it('appends numeric suffix', () => {
    expect(withSlugSuffix('acme', 2)).toBe('acme-2');
  });
});
