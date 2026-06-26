import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  appendLearnedRule,
  reloadLearnedRules,
  resetLearnedRulesForTests,
  setLearnedRulesPathForTests,
  LearnedRulesSignatureError,
} from "../src/learned-rules-store.js";
import {
  signLearnedRulesJson,
  learnedRulesSignaturePath,
  validateSignedLearnedRulesJson,
} from "../src/learned-rules-signature.js";

const baseProvenance = {
  attackClass: "test-attack",
  hypothesis: "test hypothesis",
  confidence: 0.95,
  fingerprint: "fp-test-001",
  source: "test",
  promotedAt: new Date().toISOString(),
};

describe("learned rules Ed25519 signature", () => {
  let tempDir: string;
  let rulesPath: string;
  let privateJwk: string;
  let publicJwk: string;

  beforeEach(() => {
    resetLearnedRulesForTests();
    tempDir = mkdtempSync(join(tmpdir(), "learned-rules-sig-"));
    rulesPath = join(tempDir, "learned-rules.json");
    setLearnedRulesPathForTests(rulesPath);
    process.env.MASTYF_AI_LEARNED_RULES_ENABLED = "true";

    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    privateJwk = JSON.stringify(privateKey.export({ format: "jwk" }));
    publicJwk = JSON.stringify(publicKey.export({ format: "jwk" }));
    process.env.MASTYF_AI_LEARNED_RULES_SIGNING_PRIVATE_KEY = privateJwk;
    process.env.MASTYF_AI_LEARNED_RULES_VERIFY_PUBLIC_KEY = publicJwk;
    delete process.env.MASTYF_AI_REQUIRE_SIGNED_LEARNED_RULES;
    delete process.env.MASTYF_AI_LEARNED_RULES_SIGNATURE_OPTIONAL;
    delete process.env.NODE_ENV;
    delete process.env.MASTYF_AI_STRICT_MODE;
  });

  afterEach(() => {
    process.env.MASTYF_AI_LEARNED_RULES_ENABLED = "false";
    delete process.env.MASTYF_AI_LEARNED_RULES_SIGNING_PRIVATE_KEY;
    delete process.env.MASTYF_AI_LEARNED_RULES_VERIFY_PUBLIC_KEY;
    delete process.env.MASTYF_AI_REQUIRE_SIGNED_LEARNED_RULES;
    resetLearnedRulesForTests();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes Ed25519 sidecar on append when signing key is set", () => {
    appendLearnedRule(
      {
        target: "argument",
        regex: "sig_test_marker",
        category: "prompt-injection",
        severity: "critical",
        weight: 0.85,
        message: "sig test",
        probe: "sig_test_marker",
        provenance: baseProvenance,
      },
      { skipFalsePositiveCheck: true },
    );
    const sigPath = learnedRulesSignaturePath(rulesPath);
    const json = readFileSync(rulesPath, "utf-8");
    const envelope = JSON.parse(readFileSync(sigPath, "utf-8"));
    expect(envelope.alg).toBe("Ed25519");
    expect(validateSignedLearnedRulesJson(json, envelope).ok).toBe(true);
  });

  it("rejects tampered file when signature required", () => {
    const json = JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), rules: [] }, null, 2);
    writeFileSync(rulesPath, json);
    const envelope = signLearnedRulesJson(json, {
      alg: "Ed25519",
      issuer: "mastyf-ai-admin",
      keyId: "default",
      issuedAt: new Date().toISOString(),
    });
    writeFileSync(learnedRulesSignaturePath(rulesPath), JSON.stringify(envelope));

    writeFileSync(rulesPath, json.replace('"rules": []', '"rules": [{"id":"evil"}]'));

    process.env.MASTYF_AI_REQUIRE_SIGNED_LEARNED_RULES = "true";
    expect(() => reloadLearnedRules()).toThrow(LearnedRulesSignatureError);
  });
});
