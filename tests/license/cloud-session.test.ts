import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { mapCloudRoles, verifyCloudSessionToken } from '../../src/license/cloud-session.js';

describe('cloud-session', () => {
  it('maps cloud roles to dashboard roles', () => {
    expect(mapCloudRoles(['tenant-admin', 'unknown'])).toEqual(['tenant-admin']);
    expect(mapCloudRoles([])).toEqual(['tenant-admin']);
  });

  it('verifies tokens signed with MASTYFF_AI_CLOUD_JWT_SECRET', () => {
    process.env.MASTYFF_AI_CLOUD_JWT_SECRET = 'mastyff-ai-test-secret';
    const payload = {
      tenantSlug: 'acme',
      identity: 'cloud:acme',
      roles: ['tenant-admin'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', 'mastyff-ai-test-secret').update(encoded).digest('base64url');
    const token = `${encoded}.${sig}`;
    const verified = verifyCloudSessionToken(token);
    expect(verified?.tenantSlug).toBe('acme');
  });
});
