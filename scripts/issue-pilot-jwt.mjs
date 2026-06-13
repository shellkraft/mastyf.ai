#!/usr/bin/env node
/**
 * Issue pilot JWTs for acme/beta tenants (MULTI_TENANCY.md production pilot step 1).
 * Requires DASHBOARD_JWT_SECRET or pass as argv.
 */
import { SignJWT } from 'jose';

const secret = process.argv[2] ?? process.env.DASHBOARD_JWT_SECRET;
if (!secret) {
  console.error('Usage: node scripts/issue-pilot-jwt.mjs [DASHBOARD_JWT_SECRET]');
  console.error('Or set DASHBOARD_JWT_SECRET in the environment.');
  process.exit(1);
}

const key = new TextEncoder().encode(secret);
const claim = process.env.MASTYFF_AI_JWT_TENANT_CLAIM ?? 'tenant_id';

async function token(tenantId, sub) {
  return new SignJWT({ [claim]: tenantId, role: 'tenant-admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key);
}

for (const tenant of ['acme', 'beta']) {
  const t = await token(tenant, `pilot-${tenant}`);
  console.log(`\n# ${tenant}\nexport JWT_${tenant.toUpperCase()}='${t}'\n`);
}
