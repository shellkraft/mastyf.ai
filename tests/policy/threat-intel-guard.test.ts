import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import type { PolicyConfig } from '../../src/policy/policy-types.js';
import { evaluateThreatIntelGuard, resetThreatIntelGuardCache } from '../../src/policy/threat-intel-guard.js';

const defaultPolicy = load(
  readFileSync(join(process.cwd(), 'default-policy.yaml'), 'utf-8'),
) as PolicyConfig;

function engine(): PolicyEngine {
  return new PolicyEngine(defaultPolicy);
}

describe('threat-intel-guard', () => {
  beforeEach(() => {
    resetThreatIntelGuardCache();
    delete process.env.MASTYFF_AI_DISABLE_THREAT_INTEL_GUARD;
  });

  it('blocks allowlisted search when query matches baseline threat signature', () => {
    const decision = evaluateThreatIntelGuard({
      serverName: 'test',
      toolName: 'search',
      arguments: {
        query: "Anthropic's MCP TypeScript SDK has a ReDoS vulnerability",
      },
      requestId: '1',
      requestTokens: 10,
    });
    expect(decision?.action).toBe('block');
    expect(decision?.rule).toBe('threat-intel');
  });

  it('passes benign search queries', () => {
    const decision = evaluateThreatIntelGuard({
      serverName: 'test',
      toolName: 'search',
      arguments: { query: 'quarterly revenue by region' },
      requestId: '2',
      requestTokens: 10,
    });
    expect(decision).toBeNull();
  });

  it('blocks adv-123 through PolicyEngine even when search is allowlisted', () => {
    const eng = engine();
    const decision = eng.evaluate({
      serverName: 'harness',
      toolName: 'search',
      arguments: {
        query: "Anthropic's MCP TypeScript SDK has a ReDoS vulnerability",
      },
      requestId: 'adv-123',
      requestTokens: 50,
    });
    expect(decision.action).toBe('block');
    expect(decision.rule).toBe('threat-intel');
  });

  it('blocks cross-origin MCP threat intel probes', () => {
    const eng = engine();
    const decision = eng.evaluate({
      serverName: 'harness',
      toolName: 'search',
      arguments: {
        query: 'Network-AI: Unauthenticated Cross-Origin MCP Tool Invocation via Empty Default Secret',
      },
      requestId: 'adv-130',
      requestTokens: 50,
    });
    expect(decision.action).toBe('block');
    expect(decision.rule).toBe('threat-intel');
  });
});
