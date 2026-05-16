import { describe, it, expect, afterEach } from 'vitest';
import { evaluatePathGuard } from '../../src/policy/path-guard.js';

describe('evaluatePathGuard', () => {
  afterEach(() => {
    delete process.env.GUARDIAN_WORKSPACE;
    delete process.env.GUARDIAN_ALLOWED_PATH_PREFIXES;
  });

  it('blocks filesystem root', () => {
    expect(evaluatePathGuard(['/']).block).toBe(true);
  });

  it('blocks .ssh paths', () => {
    expect(evaluatePathGuard(['/home/user/.ssh/config']).block).toBe(true);
  });

  it('scopes to workspace when set', () => {
    process.env.GUARDIAN_WORKSPACE = '/workspace/app';
    expect(evaluatePathGuard(['/workspace/app/src/a.ts']).block).toBe(false);
    expect(evaluatePathGuard(['/etc/passwd']).block).toBe(true);
    const outside = evaluatePathGuard(['/tmp/other']);
    expect(outside.block).toBe(true);
  });
});
