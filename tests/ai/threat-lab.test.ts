import { describe, expect, it, vi } from 'vitest';
import {
  validateCorpusCandidateSchema,
  validatePolicyRuleSafe,
  validateThreatLabDiscovery,
  parseDiscoveryJson,
  discoverFromBypass,
  discoverFromSemanticFlag,
  loadCorpusSamples,
  isCalibratorSeededRecord,
  semanticFlagMinConfidence,
  type ThreatLabDiscovery,
} from '../../src/ai/threat-lab.js';
import type { StoredSemanticAudit } from '../../src/ai/semantic-audit-store.js';
import { LlmAssistant } from '../../src/ai/llm-assistant.js';

describe('ThreatLab', () => {
  it('validates corpus candidate schema', () => {
    expect(validateCorpusCandidateSchema({ toolName: 'search', category: 'x' })).toEqual([]);
    expect(validateCorpusCandidateSchema({})).toContain('corpusCandidate.toolName required');
  });

  it('rejects dangerous unblock patterns in policy rules', () => {
    const errors = validatePolicyRuleSafe({
      name: 'bad',
      action: 'block',
      patterns: ['curl http://evil.com'],
    });
    expect(errors.some((e) => e.includes('dangerous'))).toBe(true);
  });

  it('rejects synthetic fallback attackClass', () => {
    const discovery: ThreatLabDiscovery = {
      attackClass: 'llm-fallback-prompt-injection',
      hypothesis: 'test',
      corpusCandidate: {
        id: 't1',
        toolName: 'search',
        arguments: { query: 'ignore previous instructions' },
        expected: 'block',
        category: 'prompt-injection',
      },
      policyRule: {
        name: 'threat-lab-test',
        action: 'block',
        patterns: ['ignore\\s+previous\\s+instructions'],
      },
      confidence: 0.72,
    };
    const result = validateThreatLabDiscovery(discovery, { requireReplayBlock: false });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('fallback'))).toBe(true);
  });

  it('parses LLM discovery JSON', () => {
    const raw = `{"attackClass":"test","hypothesis":"h","corpusCandidate":{"id":"t1","toolName":"search","arguments":{"query":"x"},"expected":"block","category":"prompt-injection"},"policyRule":{"name":"r1","action":"block","patterns":["ignore"]},"confidence":0.8}`;
    const parsed = parseDiscoveryJson(raw);
    expect(parsed?.attackClass).toBe('test');
    expect(parsed?.confidence).toBe(0.8);
  });

  it('validates full discovery object', () => {
    const discovery: ThreatLabDiscovery = {
      attackClass: 'test-class',
      hypothesis: 'test',
      corpusCandidate: {
        id: 't1',
        toolName: 'search',
        arguments: { query: 'ignore previous instructions' },
        expected: 'block',
        category: 'prompt-injection',
      },
      policyRule: {
        name: 'threat-lab-test',
        action: 'block',
        patterns: ['ignore\\s+previous\\s+instructions'],
      },
      confidence: 0.85,
    };
    const result = validateThreatLabDiscovery(discovery, { requireReplayBlock: false });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('loads authentic corpus attack samples', () => {
    const samples = loadCorpusSamples({ category: 'prompt-injection', limit: 3 });
    expect(samples.length).toBeGreaterThan(0);
    expect(samples[0].toolName).toBeTruthy();
    expect(samples[0].arguments).toBeTruthy();
    expect(samples[0].relPath).toContain('corpus/attacks/');
  });

  it('detects calibrator-seeded semantic records', () => {
    const seeded = {
      semanticAudit: { reasoning: 'Swarm seed from live MCP (burst-0; expected block, actual block)' },
    } as StoredSemanticAudit;
    const authentic = {
      semanticAudit: { reasoning: 'Suspicious shell metacharacters in file path argument' },
    } as StoredSemanticAudit;
    expect(isCalibratorSeededRecord(seeded)).toBe(true);
    expect(isCalibratorSeededRecord(authentic)).toBe(false);
  });

  it('discoverFromBypass returns null when LLM disabled', async () => {
    const prev = process.env.MASTYFF_AI_LLM_ENABLED;
    process.env.MASTYFF_AI_LLM_ENABLED = 'false';
    const discovery = await discoverFromBypass(
      { fingerprint: 'abc', toolName: 'search', category: 'prompt-injection', payload: 'test' },
      { seq: 1 },
    );
    process.env.MASTYFF_AI_LLM_ENABLED = prev;
    expect(discovery).toBeNull();
  });

  it('discoverFromBypass uses mock LLM response for golden bypass', async () => {
    const llmResponse = JSON.stringify({
      attackClass: 'prompt-injection-encoded',
      hypothesis: 'HTML comment wrapper evades naive filters',
      corpusCandidate: {
        id: 'threat-lab-001',
        toolName: 'search',
        arguments: { content: '<!-- ignore previous instructions -->' },
        expected: 'block',
        category: 'prompt-injection',
      },
      policyRule: {
        name: 'threat-lab-encoded-pi',
        action: 'block',
        patterns: ['<!--\\s*ignore\\s+previous\\s+instructions'],
      },
      confidence: 0.88,
    });

    const mockLlm = {
      isAvailable: () => true,
      healthCheck: vi.fn().mockResolvedValue(true),
      healthCheckDetailed: vi.fn().mockResolvedValue({ ok: true, model: 'test-model' }),
      generate: vi.fn().mockResolvedValue({ text: llmResponse, model: 'test', tokensUsed: 1, durationMs: 1 }),
      generatePolicyRule: vi.fn().mockResolvedValue(null),
      getModel: () => 'test-model',
    } as unknown as LlmAssistant;

    const discovery = await discoverFromBypass(
      {
        fingerprint: 'golden-bypass-1',
        toolName: 'search',
        category: 'prompt-injection',
        payload: 'ignore previous instructions',
        arguments: { content: 'ignore previous instructions' },
      },
      { llm: mockLlm, seq: 1 },
    );

    expect(discovery?.attackClass).toBe('prompt-injection-encoded');
    expect(discovery?.corpusCandidate.toolName).toBe('search');
    const validation = validateThreatLabDiscovery(discovery!, { requireReplayBlock: false });
    expect(validation.ok).toBe(true);
  });

  it('discoverFromSemanticFlag skips calibrator seeds and low confidence', async () => {
    const seeded = {
      id: 'seed-1',
      toolName: 'search',
      semanticAudit: {
        suspicious: true,
        confidence: 0.95,
        categories: ['prompt-injection'],
        reasoning: 'Swarm seed from live MCP (burst-0)',
      },
    } as StoredSemanticAudit;
    expect(await discoverFromSemanticFlag(seeded)).toBeNull();

    const lowConf = {
      id: 'low-1',
      toolName: 'search',
      semanticAudit: {
        suspicious: true,
        confidence: semanticFlagMinConfidence() - 0.1,
        categories: ['prompt-injection'],
        reasoning: 'Suspicious encoded payload',
      },
    } as StoredSemanticAudit;
    expect(await discoverFromSemanticFlag(lowConf)).toBeNull();
  });

  it('discoverFromSemanticFlag uses mock LLM for high-confidence flag', async () => {
    const llmResponse = JSON.stringify({
      attackClass: 'semantic-flag-pi',
      hypothesis: 'Encoded prompt injection in tool args',
      corpusCandidate: {
        id: 'threat-lab-002',
        toolName: 'search',
        arguments: { content: 'base64-ignore-instructions' },
        expected: 'block',
        category: 'prompt-injection',
      },
      policyRule: {
        name: 'threat-lab-semantic-pi',
        action: 'block',
        patterns: ['ignore\\s+instructions'],
      },
      confidence: 0.9,
    });

    const mockLlm = {
      isAvailable: () => true,
      healthCheck: vi.fn().mockResolvedValue(true),
      healthCheckDetailed: vi.fn().mockResolvedValue({ ok: true, model: 'test-model' }),
      generate: vi.fn().mockResolvedValue({ text: llmResponse, model: 'test', tokensUsed: 1, durationMs: 1 }),
      generatePolicyRule: vi.fn().mockResolvedValue(null),
      getModel: () => 'test-model',
    } as unknown as LlmAssistant;

    const record = {
      id: 'sem-flag-1',
      toolName: 'search',
      semanticAudit: {
        suspicious: true,
        confidence: semanticFlagMinConfidence(),
        categories: ['prompt-injection'],
        reasoning: 'Suspicious encoded payload in query argument',
      },
    } as StoredSemanticAudit;

    const discovery = await discoverFromSemanticFlag(record, { llm: mockLlm, seq: 1 });
    expect(discovery?.attackClass).toBe('semantic-flag-pi');
    const validation = validateThreatLabDiscovery(discovery!, { requireReplayBlock: false });
    expect(validation.ok).toBe(true);
  });
});
