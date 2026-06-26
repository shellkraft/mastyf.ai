import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { basename, dirname, join } from "node:path";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface LearnedRulesSignatureEnvelope {
  alg: "Ed25519";
  issuer: string;
  keyId: string;
  issuedAt: string;
  expiresAt?: string;
  signature: string;
}

export interface LearnedRulesSignatureValidationResult {
  ok: boolean;
  reason?: string;
}

function trustedIssuers(): Set<string> {
  const raw = process.env["MASTYF_AI_LEARNED_RULES_TRUSTED_ISSUERS"] || "mastyf-ai-admin";
  return new Set(raw.split(",").map((v) => v.trim()).filter(Boolean));
}

function signaturePayload(json: string, env: Omit<LearnedRulesSignatureEnvelope, "signature">): Buffer {
  return Buffer.from(
    [json, env.alg, env.issuer, env.keyId, env.issuedAt, env.expiresAt || ""].join("\n"),
    "utf-8",
  );
}

function parseJwk(raw: string): Record<string, string> {
  const jwk = JSON.parse(raw) as Record<string, string>;
  if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519") {
    throw new Error("JWK must be Ed25519 (kty=OKP, crv=Ed25519)");
  }
  return jwk;
}

function privateKeyForKeyId(keyId: string): ReturnType<typeof createPrivateKey> | null {
  const envKey = `MASTYF_AI_LEARNED_RULES_SIGNING_PRIVATE_KEY_${keyId}`;
  const raw = process.env[envKey] || process.env["MASTYF_AI_LEARNED_RULES_SIGNING_PRIVATE_KEY"];
  if (!raw) return null;
  try {
    return createPrivateKey({ key: parseJwk(raw), format: "jwk" });
  } catch {
    return createPrivateKey(raw);
  }
}

function publicKeyForKeyId(keyId: string): ReturnType<typeof createPublicKey> | null {
  const envKey = `MASTYF_AI_LEARNED_RULES_VERIFY_PUBLIC_KEY_${keyId}`;
  const raw = process.env[envKey] || process.env["MASTYF_AI_LEARNED_RULES_VERIFY_PUBLIC_KEY"];
  if (!raw) return null;
  try {
    return createPublicKey({ key: parseJwk(raw), format: "jwk" });
  } catch {
    return createPublicKey(raw);
  }
}

export function learnedRulesSignaturePath(rulesPath: string): string {
  return join(dirname(rulesPath), `.${basename(rulesPath)}.sig.json`);
}

export function readLearnedRulesSignatureEnvelope(rulesPath: string): LearnedRulesSignatureEnvelope | undefined {
  const sigPath = learnedRulesSignaturePath(rulesPath);
  if (!existsSync(sigPath)) return undefined;
  try {
    return JSON.parse(readFileSync(sigPath, "utf-8")) as LearnedRulesSignatureEnvelope;
  } catch {
    return undefined;
  }
}

export function writeLearnedRulesSignatureEnvelope(
  rulesPath: string,
  envelope: LearnedRulesSignatureEnvelope,
): void {
  writeFileSync(learnedRulesSignaturePath(rulesPath), JSON.stringify(envelope, null, 2));
}

export function signLearnedRulesJson(
  json: string,
  envelope: Omit<LearnedRulesSignatureEnvelope, "signature">,
): LearnedRulesSignatureEnvelope {
  const privateKey = privateKeyForKeyId(envelope.keyId);
  if (!privateKey) {
    throw new Error(`Missing Ed25519 private key for keyId '${envelope.keyId}'`);
  }
  const sig = sign(null, signaturePayload(json, envelope), privateKey);
  return { ...envelope, signature: sig.toString("base64") };
}

export function isLearnedRulesSignatureRequired(): boolean {
  return (
    process.env["MASTYF_AI_REQUIRE_SIGNED_LEARNED_RULES"] === "true"
    || (process.env["MASTYF_AI_LEARNED_RULES_ENABLED"] === "true"
      && process.env["MASTYF_AI_LEARNED_RULES_SIGNATURE_OPTIONAL"] !== "true"
      && (process.env["NODE_ENV"] === "production"
        || process.env["MASTYF_AI_STRICT_MODE"] === "true"))
  );
}

export function validateSignedLearnedRulesJson(
  json: string,
  envelope: LearnedRulesSignatureEnvelope | undefined,
): LearnedRulesSignatureValidationResult {
  const required = isLearnedRulesSignatureRequired();

  if (!envelope) {
    return required
      ? { ok: false, reason: "missing signature envelope — unsigned learned rules rejected" }
      : { ok: true };
  }
  if (envelope.alg !== "Ed25519") {
    return { ok: false, reason: `unsupported signature algorithm '${envelope.alg}'` };
  }
  if (!trustedIssuers().has(envelope.issuer)) {
    return { ok: false, reason: `untrusted issuer '${envelope.issuer}'` };
  }
  if (envelope.expiresAt && Date.now() > Date.parse(envelope.expiresAt)) {
    return { ok: false, reason: "signature expired" };
  }
  const publicKey = publicKeyForKeyId(envelope.keyId);
  if (!publicKey) {
    return { ok: false, reason: `missing Ed25519 public key for keyId '${envelope.keyId}'` };
  }
  const ok = verify(
    null,
    signaturePayload(json, {
      alg: envelope.alg,
      issuer: envelope.issuer,
      keyId: envelope.keyId,
      issuedAt: envelope.issuedAt,
      expiresAt: envelope.expiresAt,
    }),
    publicKey,
    Buffer.from(envelope.signature || "", "base64"),
  );
  if (!ok) {
    return { ok: false, reason: "Ed25519 signature mismatch" };
  }
  return { ok: true };
}

export function hasLearnedRulesSigningKey(): boolean {
  if (process.env["MASTYF_AI_LEARNED_RULES_SIGNING_PRIVATE_KEY"]) return true;
  return Object.keys(process.env).some((k) => k.startsWith("MASTYF_AI_LEARNED_RULES_SIGNING_PRIVATE_KEY_"));
}
