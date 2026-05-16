import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  recordFpRejection,
  isFpWhitelisted,
  clearFpWhitelistForTests,
  fpFingerprint,
} from '../../src/ai/fp-whitelist.js';

describe('fp-whitelist', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mcp-guardian-fp-'));
    process.env.GUARDIAN_FP_WHITELIST_PATH = join(tempDir, '.fp-whitelist.json');
    process.env.GUARDIAN_FP_WHITELIST_THRESHOLD = '3';
    clearFpWhitelistForTests();
  });

  afterEach(() => {
    clearFpWhitelistForTests();
    delete process.env.GUARDIAN_FP_WHITELIST_PATH;
    delete process.env.GUARDIAN_FP_WHITELIST_THRESHOLD;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('requires 3 confirmations from distinct labelers before whitelisting', () => {
    const rule = 'semantic-prompt-injection';
    const pattern = 'ignore-instructions';
    expect(isFpWhitelisted(rule, pattern)).toBe(false);

    const users = ['analyst-a', 'analyst-b', 'analyst-c'];
    let last = recordFpRejection(rule, pattern, { userId: users[0] });
    expect(last.whitelisted).toBe(false);
    expect(last.confirmCount).toBe(1);
    expect(isFpWhitelisted(rule, pattern)).toBe(false);

    last = recordFpRejection(rule, pattern, { userId: users[1] });
    expect(last.confirmCount).toBe(2);
    expect(isFpWhitelisted(rule, pattern)).toBe(false);

    last = recordFpRejection(rule, pattern, { userId: users[2] });
    expect(last.whitelisted).toBe(true);
    expect(isFpWhitelisted(rule, pattern)).toBe(true);
  });

  it('uses stable fingerprints per rule+pattern', () => {
    const a = fpFingerprint('secret-scan', 'github-pat-classic');
    const b = fpFingerprint('secret-scan', 'github-pat-classic');
    const c = fpFingerprint('secret-scan', 'openai-api-key');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
