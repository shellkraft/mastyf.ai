import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  AuditHashChain,
  appendChainedJsonlLine,
  appendSiemChainedEvent,
  verifyChainedJsonlLines,
  type ChainedAuditLine,
} from '../../src/utils/audit-hash-chain.js';
import { PolicyAuditor } from '../../src/utils/policy-auditor.js';

describe('audit hash chain', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'audit-chain-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.MASTYFF_AI_AUDIT_HASH_CHAIN;
    delete process.env.MASTYFF_AI_AUDIT_HASH_CHAIN_SIEM;
    delete process.env.MASTYFF_AI_AUDIT_HASH_CHAIN_SIEM_LOG;
    delete process.env.POLICY_AUDIT_ENABLED;
  });

  it('chains consecutive entries', () => {
    const chain = new AuditHashChain();
    const a = chain.append({ event: 'a' });
    const b = chain.append({ event: 'b' });
    expect(b.prev_hash).toBe(a.entry_hash);
    expect(verifyChainedJsonlLines([a, b])).toBe(-1);
  });

  it('detects tampered entry_hash', () => {
    const chain = new AuditHashChain();
    const a = chain.append({ event: 'a' });
    const tampered = { ...a, entry_hash: 'deadbeef' };
    expect(verifyChainedJsonlLines([tampered])).toBe(0);
  });

  it('appends chained lines to jsonl file', () => {
    const path = join(dir, 'audit.jsonl');
    appendChainedJsonlLine(path, { change: 'one' });
    appendChainedJsonlLine(path, { change: 'two' });
    const lines = readFileSync(path, 'utf-8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as ChainedAuditLine);
    expect(lines).toHaveLength(2);
    expect(lines[1]!.prev_hash).toBe(lines[0]!.entry_hash);
    expect(verifyChainedJsonlLines(lines)).toBe(-1);
  });

  it('appends SIEM events to chained log when enabled', () => {
    process.env.MASTYFF_AI_AUDIT_HASH_CHAIN = 'true';
    const path = join(dir, 'siem.jsonl');
    process.env.MASTYFF_AI_AUDIT_HASH_CHAIN_SIEM_LOG = path;
    appendSiemChainedEvent('tool_blocked', { toolName: 'eval', serverName: 's1' });
    appendSiemChainedEvent('policy_decision', { toolName: 'eval', serverName: 's1' });
    const lines = readFileSync(path, 'utf-8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as ChainedAuditLine);
    expect(lines).toHaveLength(2);
    expect(verifyChainedJsonlLines(lines)).toBe(-1);
  });

  it('policy auditor uses hash chain when enabled', () => {
    process.env.POLICY_AUDIT_ENABLED = 'true';
    process.env.MASTYFF_AI_AUDIT_HASH_CHAIN = 'true';
    const path = join(dir, 'policy.jsonl');
    const auditor = new PolicyAuditor(path);
    auditor.record({ timestamp: 't1', actor: 'test', change: 'rule added' });
    auditor.record({ timestamp: 't2', actor: 'test', change: 'rule updated' });
    const lines = readFileSync(path, 'utf-8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as ChainedAuditLine);
    expect(verifyChainedJsonlLines(lines)).toBe(-1);
  });
});
