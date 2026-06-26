import { describe, it, expect, beforeEach } from 'vitest';
import { getSemanticRequestGateStatus } from '../../src/ai/sync-semantic-request.js';
import { resetLlmConfigForTests } from '../../src/config/llm-config.js';

describe('semantic_layer_active (M-002)', () => {
  beforeEach(() => {
    resetLlmConfigForTests();
  });
  it('exposes semantic_layer_active when LLM is configured and gate enabled', () => {
    process.env.MASTYF_AI_SEMANTIC_SYNC_REQUEST = 'true';
    process.env.MASTYF_AI_SEMANTIC_SYNC_REQUEST_LLM = 'true';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    const status = getSemanticRequestGateStatus();
    expect(status.semantic_layer_active).toBe(true);
    expect(status.semanticRequestGate).toBe('enabled');
    delete process.env.MASTYF_AI_SEMANTIC_SYNC_REQUEST;
    delete process.env.MASTYF_AI_SEMANTIC_SYNC_REQUEST_LLM;
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('marks semantic_layer_active false when LLM key missing', () => {
    process.env.MASTYF_AI_SEMANTIC_SYNC_REQUEST = 'true';
    process.env.MASTYF_AI_SEMANTIC_SYNC_REQUEST_LLM = 'true';
    process.env.MASTYF_AI_LLM_PROVIDER = 'anthropic';
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const status = getSemanticRequestGateStatus();
    expect(status.semantic_layer_active).toBe(false);
    expect(status.semanticRequestGate).toBe('degraded');
    delete process.env.MASTYF_AI_SEMANTIC_SYNC_REQUEST;
    delete process.env.MASTYF_AI_SEMANTIC_SYNC_REQUEST_LLM;
    delete process.env.MASTYF_AI_LLM_PROVIDER;
  });
});
