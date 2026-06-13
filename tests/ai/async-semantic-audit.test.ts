import { describe, it, expect, afterEach } from 'vitest';
import {
  isSemanticAsyncEnabled,
  buildSemanticAuditJob,
  getSemanticAuditStats,
} from '../../src/ai/async-semantic-audit.js';

describe('async-semantic-audit', () => {
  const prevAsync = process.env.MASTYFF_AI_SEMANTIC_ASYNC;
  const prevLlm = process.env.MASTYFF_AI_LLM_ENABLED;

  afterEach(() => {
    if (prevAsync === undefined) delete process.env.MASTYFF_AI_SEMANTIC_ASYNC;
    else process.env.MASTYFF_AI_SEMANTIC_ASYNC = prevAsync;
    if (prevLlm === undefined) delete process.env.MASTYFF_AI_LLM_ENABLED;
    else process.env.MASTYFF_AI_LLM_ENABLED = prevLlm;
  });

  it('defaults async on when LLM enabled', () => {
    delete process.env.MASTYFF_AI_SEMANTIC_ASYNC;
    process.env.MASTYFF_AI_LLM_ENABLED = 'true';
    expect(isSemanticAsyncEnabled()).toBe(true);
  });

  it('respects MASTYFF_AI_SEMANTIC_ASYNC=false', () => {
    process.env.MASTYFF_AI_SEMANTIC_ASYNC = 'false';
    expect(isSemanticAsyncEnabled()).toBe(false);
  });

  it('exposes semantic audit stats', () => {
    const stats = getSemanticAuditStats();
    expect(stats).toMatchObject({ queued: expect.any(Number), enabled: expect.any(Boolean) });
  });

  it('builds audit job from call context', () => {
    const job = buildSemanticAuditJob(
      {
        serverName: 'srv',
        toolName: 'read_file',
        arguments: { path: '/tmp' },
        requestId: 'req-1',
        requestTokens: 10,
        timestamp: '2026-05-16T00:00:00Z',
      },
      { action: 'pass', rule: 'default', reason: 'ok' },
    );
    expect(job.toolName).toBe('read_file');
    expect(job.syncDecision.action).toBe('pass');
  });
});
