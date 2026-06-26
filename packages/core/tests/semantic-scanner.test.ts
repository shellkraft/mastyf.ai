import { describe, expect, it } from "vitest";
import { hashLlmCacheKeyForTests } from "../src/ai/llm-cache.js";

describe("semantic LLM cache keys", () => {
  const base = {
    model: "claude-test",
    system: "system prompt",
    prompt: "tool prompt",
    temperature: 0,
    policyMode: "block",
  };

  it("includes onlyOnHits and alwaysRun in the cache hash", () => {
    const thorough = hashLlmCacheKeyForTests({
      ...base,
      onlyOnHits: false,
      alwaysRun: true,
    });
    const hitsOnly = hashLlmCacheKeyForTests({
      ...base,
      onlyOnHits: true,
      alwaysRun: false,
    });
    expect(thorough).not.toBe(hitsOnly);
  });

  it("keeps stable hash for identical scan mode options", () => {
    const a = hashLlmCacheKeyForTests({ ...base, onlyOnHits: false, alwaysRun: true });
    const b = hashLlmCacheKeyForTests({ ...base, onlyOnHits: false, alwaysRun: true });
    expect(a).toBe(b);
  });
});

describe("semantic strict fail-closed", () => {
  it("returns critical MCPG-META-005 when strict and no API key", async () => {
    const prevStrict = process.env.MASTYF_AI_SEMANTIC_STRICT;
    const prevProvider = process.env.MASTYF_AI_LLM_PROVIDER;
    const prevOllama = process.env.OLLAMA_ENABLED;
    delete process.env.ANTHROPIC_API_KEY;
    process.env.MASTYF_AI_SEMANTIC_STRICT = "true";
    process.env.MASTYF_AI_LLM_PROVIDER = "anthropic";
    delete process.env.OLLAMA_ENABLED;
    process.env.MASTYF_AI_LLM_CACHE = "false";

    try {
      const { resetLlmConfigForTests } = await import("../src/config/llm-config.js");
      resetLlmConfigForTests();
      const { runSemanticScan } = await import("../src/semantic-scanner.js");
      const issues = await runSemanticScan(
        { name: "test", description: "safe tool" },
        [],
        { onlyOnHits: false, alwaysRun: true },
      );
      const blocked = issues.find((i) => i.id === "MCPG-META-005");
      expect(blocked).toBeDefined();
      expect(blocked!.severity).toBe("critical");
    } finally {
      if (prevStrict === undefined) delete process.env.MASTYF_AI_SEMANTIC_STRICT;
      else process.env.MASTYF_AI_SEMANTIC_STRICT = prevStrict;
      if (prevProvider === undefined) delete process.env.MASTYF_AI_LLM_PROVIDER;
      else process.env.MASTYF_AI_LLM_PROVIDER = prevProvider;
      if (prevOllama === undefined) delete process.env.OLLAMA_ENABLED;
      else process.env.OLLAMA_ENABLED = prevOllama;
      delete process.env.MASTYF_AI_LLM_CACHE;
      const { resetLlmConfigForTests } = await import("../src/config/llm-config.js");
      resetLlmConfigForTests();
      const { resetCoreSemanticCircuitForTests } = await import("../src/semantic-circuit-breaker.js");
      resetCoreSemanticCircuitForTests();
    }
  });
});

describe("Anthropic error redaction", () => {
  it("does not echo API keys in surfaced error messages", async () => {
    const apiKey = "sk-ant-api03-test-secret-key-value";
    const originalFetch = globalThis.fetch;
    process.env.ANTHROPIC_API_KEY = apiKey;
    process.env.MASTYF_AI_LLM_CACHE = "false";

    globalThis.fetch = (async () =>
      new Response(`Invalid API key: ${apiKey}`, { status: 401 })) as typeof fetch;

    try {
      const { runSemanticScan } = await import("../src/semantic-scanner.js");
      const issues = await runSemanticScan(
        { name: "test", description: "safe tool" },
        [],
        { apiKey, onlyOnHits: false, alwaysRun: true },
      );
      const errIssue = issues.find((i) => i.id === "MCPG-META-003");
      expect(errIssue).toBeDefined();
      expect(errIssue!.message).not.toContain(apiKey);
      expect(errIssue!.message).toContain("[REDACTED]");
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.MASTYF_AI_LLM_CACHE;
      const { resetLlmConfigForTests } = await import("../src/config/llm-config.js");
      resetLlmConfigForTests();
      const { resetCoreSemanticCircuitForTests } = await import("../src/semantic-circuit-breaker.js");
      resetCoreSemanticCircuitForTests();
    }
  });
});
