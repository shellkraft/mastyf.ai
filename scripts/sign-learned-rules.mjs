#!/usr/bin/env node
/**
 * Sign learned-rules.json with Ed25519 (sidecar .learned-rules.json.sig.json).
 *
 * Requires MASTYF_AI_LEARNED_RULES_SIGNING_PRIVATE_KEY (Ed25519 JWK JSON).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createPrivateKey, sign } from 'node:crypto';

const rulesPath =
  process.argv[2] || join(homedir(), '.mastyf-ai', 'learned-rules.json');

const raw = process.env.MASTYF_AI_LEARNED_RULES_SIGNING_PRIVATE_KEY;
if (!raw) {
  console.error('Set MASTYF_AI_LEARNED_RULES_SIGNING_PRIVATE_KEY (Ed25519 JWK JSON)');
  process.exit(1);
}

const json = readFileSync(rulesPath, 'utf-8');
const keyId = process.env.MASTYF_AI_LEARNED_RULES_SIGNING_KEY_ID || 'default';
const issuer = process.env.MASTYF_AI_LEARNED_RULES_SIGNING_ISSUER || 'mastyf-ai-admin';
const issuedAt = new Date().toISOString();
const alg = 'Ed25519';

const { basename, dirname, join: pathJoin } = await import('node:path');
const privateKey = createPrivateKey({ key: JSON.parse(raw), format: 'jwk' });
const payload = Buffer.from([json, alg, issuer, keyId, issuedAt, ''].join('\n'), 'utf-8');
const signature = sign(null, payload, privateKey).toString('base64');

const envelope = { alg, issuer, keyId, issuedAt, signature };
const sigPath = pathJoin(dirname(rulesPath), `.${basename(rulesPath)}.sig.json`);
writeFileSync(sigPath, JSON.stringify(envelope, null, 2));
console.log(`Signed ${rulesPath} -> ${sigPath}`);
