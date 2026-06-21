import { describe, expect, it, beforeEach } from 'vitest';
import { hashProLicenseKey } from '../lib/pro-license-keys';
import { GET } from '../app/api/v1/license/route';

describe('GET /api/v1/license', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = 'test-license-api-secret';
    delete process.env.DATABASE_URL;
  });

  it('rejects missing bearer', async () => {
    const res = await GET(new Request('http://localhost/api/v1/license'));
    expect(res.status).toBe(401);
  });

  it('rejects unknown cloud API key without DATABASE_URL', async () => {
    const res = await GET(
      new Request('http://localhost/api/v1/license', {
        headers: { Authorization: 'Bearer mastyf_unknown_key_12345' },
      }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.licensed).toBe(false);
  });

  it('hashProLicenseKey is deterministic', () => {
    expect(hashProLicenseKey('abc')).toBe(hashProLicenseKey('abc'));
    expect(hashProLicenseKey('abc')).not.toBe(hashProLicenseKey('xyz'));
  });
});
