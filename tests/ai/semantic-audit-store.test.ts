import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('semantic-audit-store', () => {
  const prevHome = process.env.HOME;
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'mastyff-ai-sem-'));
    process.env.HOME = tempHome;
    process.env.MASTYFF_AI_TENANT_ID = 'default';
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    delete process.env.MASTYFF_AI_TENANT_ID;
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('appends and loads semantic audit records', async () => {
    const { appendSemanticAuditRecord, loadSemanticAuditRecords, labelSemanticAuditRecord } =
      await import('../../src/ai/semantic-audit-store.js');

    appendSemanticAuditRecord({
      requestId: 1,
      serverName: 'test',
      toolName: 'search',
      syncDecision: { action: 'allow', rule: 'allowlist' },
      semanticAudit: {
        suspicious: true,
        confidence: 0.9,
        categories: ['prompt-injection'],
        reasoning: 'test',
      },
      timestamp: new Date().toISOString(),
    });

    const records = loadSemanticAuditRecords({ limit: 10 });
    expect(records.length).toBe(1);
    expect(records[0].semanticAudit.suspicious).toBe(true);

    const path = join(tempHome, '.mastyff-ai', 'semantic-audit-outcomes.jsonl');
    expect(existsSync(path)).toBe(true);

    const ok = await labelSemanticAuditRecord(records[0].id, 'false_positive', 'tester');
    expect(ok).toBe(true);

    const relabeled = loadSemanticAuditRecords({ limit: 10 });
    expect(relabeled[0].label).toBe('false_positive');
    expect(readFileSync(path, 'utf-8')).toContain('false_positive');
  });
});
