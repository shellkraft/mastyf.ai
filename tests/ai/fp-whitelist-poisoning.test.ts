import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  recordFpRejection,
  isFpWhitelisted,
  clearFpWhitelistForTests,
} from '../../src/ai/fp-whitelist.js';

describe('fp-whitelist coordinated poisoning', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mastyff-ai-fp-poison-'));
    process.env.MASTYFF_AI_FP_WHITELIST_PATH = join(tempDir, '.fp-whitelist.json');
    process.env.MASTYFF_AI_FP_WHITELIST_THRESHOLD = '5';
    clearFpWhitelistForTests();
  });

  afterEach(() => {
    clearFpWhitelistForTests();
    delete process.env.MASTYFF_AI_FP_WHITELIST_PATH;
    delete process.env.MASTYFF_AI_FP_WHITELIST_THRESHOLD;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('blocks whitelist when 5 same-user confirms occur within 1 hour', () => {
    const rule = 'block-curl';
    const pattern = 'curl\\s+http';

    for (let i = 0; i < 5; i++) {
      const r = recordFpRejection(rule, pattern, { userId: 'solo-attacker' });
      if (i < 4) {
        expect(r.whitelisted).toBe(false);
      } else {
        expect(r.blocked).toBe(true);
        expect(r.whitelisted).toBe(false);
      }
    }
    expect(isFpWhitelisted(rule, pattern)).toBe(false);
  });
});
