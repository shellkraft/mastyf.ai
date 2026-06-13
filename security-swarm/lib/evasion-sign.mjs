/**
 * HMAC signing for evasion-promotions.json (tamper-evident corpus PR gate).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export function getEvasionSigningKey() {
  return (
    process.env.MASTYFF_AI_SWARM_EVASION_SIGNING_KEY?.trim() ||
    process.env.SWARM_SIGNER_KEY?.trim() ||
    ''
  );
}

/** Canonical payload for signing (excludes signature fields). */
export function canonicalEvasionPayload(manifest) {
  const { promotions, timestamp, count, instructions } = manifest;
  return JSON.stringify({ promotions, timestamp, count, instructions });
}

export function signEvasionManifest(manifest, key) {
  const secret = key || getEvasionSigningKey();
  if (!secret) return { ...manifest, signature: null, signed: false };
  const payload = canonicalEvasionPayload(manifest);
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return {
    ...manifest,
    signature,
    signed: true,
    signer: 'mastyff-ai-swarm',
    signedAt: new Date().toISOString(),
  };
}

export function verifyEvasionManifest(manifest, key) {
  const secret = key || getEvasionSigningKey();
  if (!secret) {
    return { ok: false, reason: 'MASTYFF_AI_SWARM_EVASION_SIGNING_KEY not set' };
  }
  const sig = manifest.signature;
  if (!sig || typeof sig !== 'string') {
    return { ok: false, reason: 'missing signature' };
  }
  const expected = createHmac('sha256', secret)
    .update(canonicalEvasionPayload(manifest))
    .digest('hex');
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: 'signature mismatch' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'invalid signature encoding' };
  }
}
