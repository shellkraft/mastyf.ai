import { createHmac, timingSafeEqual } from 'crypto';

export interface PolicySignatureEnvelope {
  issuer: string;
  keyId: string;
  issuedAt: string;
  expiresAt?: string;
  signature: string;
}

export interface PolicySignatureValidationResult {
  ok: boolean;
  reason?: string;
}

function signingSecretForKeyId(keyId: string): string | undefined {
  const envKey = `MASTYFF_AI_POLICY_SIGNING_KEY_${keyId}`;
  return process.env[envKey] || process.env['MASTYFF_AI_POLICY_SIGNING_KEY'] || undefined;
}

function trustedIssuers(): Set<string> {
  const raw = process.env['MASTYFF_AI_POLICY_TRUSTED_ISSUERS'] || 'mastyff-ai-admin';
  return new Set(raw.split(',').map((v) => v.trim()).filter(Boolean));
}

function signatureInput(yaml: string, env: Omit<PolicySignatureEnvelope, 'signature'>): string {
  return [
    yaml,
    env.issuer,
    env.keyId,
    env.issuedAt,
    env.expiresAt || '',
  ].join('\n');
}

export function signPolicyYaml(
  yaml: string,
  envelope: Omit<PolicySignatureEnvelope, 'signature'>,
): PolicySignatureEnvelope {
  const secret = signingSecretForKeyId(envelope.keyId);
  if (!secret) {
    throw new Error(`Missing policy signing secret for keyId '${envelope.keyId}'`);
  }
  const signature = createHmac('sha256', secret)
    .update(signatureInput(yaml, envelope))
    .digest('base64');
  return { ...envelope, signature };
}

export function validateSignedPolicyYaml(
  yaml: string,
  envelope: PolicySignatureEnvelope | undefined,
): PolicySignatureValidationResult {
  const required = process.env['MASTYFF_AI_REQUIRE_SIGNED_POLICY'] === 'true';
  if (!envelope) {
    return required
      ? { ok: false, reason: 'missing signature envelope' }
      : { ok: true };
  }
  if (!trustedIssuers().has(envelope.issuer)) {
    return { ok: false, reason: `untrusted issuer '${envelope.issuer}'` };
  }
  if (envelope.expiresAt && Date.now() > Date.parse(envelope.expiresAt)) {
    return { ok: false, reason: 'signature expired' };
  }
  const secret = signingSecretForKeyId(envelope.keyId);
  if (!secret) {
    return { ok: false, reason: `missing verifier key for keyId '${envelope.keyId}'` };
  }
  const expected = createHmac('sha256', secret)
    .update(signatureInput(yaml, {
      issuer: envelope.issuer,
      keyId: envelope.keyId,
      issuedAt: envelope.issuedAt,
      expiresAt: envelope.expiresAt,
    }))
    .digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(envelope.signature || '');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: 'signature mismatch' };
  }
  return { ok: true };
}
