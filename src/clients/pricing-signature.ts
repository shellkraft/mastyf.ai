import { createPublicKey, verify } from 'node:crypto';

export type SignedPricingEnvelope = {
  version: number;
  issuedAt: string;
  issuer: string;
  keyId: string;
  alg: 'Ed25519';
  models: Record<string, { input: number; output: number }>;
  signature: string;
};

function publicKeyForPricing(keyId: string): ReturnType<typeof createPublicKey> | null {
  const envKey = `MASTYF_AI_PRICING_VERIFY_PUBLIC_KEY_${keyId}`;
  const raw = process.env[envKey] || process.env['MASTYF_AI_PRICING_VERIFY_PUBLIC_KEY'];
  if (!raw) return null;
  try {
    const jwk = JSON.parse(raw) as Record<string, string>;
    return createPublicKey({ key: jwk, format: 'jwk' });
  } catch {
    return createPublicKey(raw);
  }
}

function signaturePayload(envelope: Omit<SignedPricingEnvelope, 'signature'>): Buffer {
  const body = JSON.stringify({
    version: envelope.version,
    issuedAt: envelope.issuedAt,
    issuer: envelope.issuer,
    keyId: envelope.keyId,
    alg: envelope.alg,
    models: envelope.models,
  });
  return Buffer.from(body, 'utf-8');
}

export function validateSignedPricingEnvelope(
  envelope: SignedPricingEnvelope,
): { ok: boolean; reason?: string } {
  if (envelope.alg !== 'Ed25519') {
    return { ok: false, reason: `unsupported pricing signature alg '${envelope.alg}'` };
  }
  const publicKey = publicKeyForPricing(envelope.keyId);
  if (!publicKey) {
    return { ok: false, reason: `missing pricing verify public key for keyId '${envelope.keyId}'` };
  }
  const ok = verify(
    null,
    signaturePayload(envelope),
    publicKey,
    Buffer.from(envelope.signature, 'base64'),
  );
  if (!ok) return { ok: false, reason: 'pricing signature mismatch' };
  return { ok: true };
}

export function detectZeroPricingAlert(
  models: Record<string, { input: number; output: number }>,
): string[] {
  const alerts: string[] = [];
  for (const [model, rates] of Object.entries(models)) {
    if (rates.input <= 0 && rates.output <= 0) {
      alerts.push(model);
    }
  }
  return alerts;
}
