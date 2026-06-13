import { describe, it, expect, afterEach } from 'vitest';
import { evaluatePathGuard } from '../../src/policy/path-guard.js';

describe('evaluatePathGuard', () => {
  afterEach(() => {
    delete process.env.MASTYFF_AI_WORKSPACE;
    delete process.env.MASTYFF_AI_ALLOWED_PATH_PREFIXES;
    delete process.env.MASTYFF_AI_REMOTE_SSH;
    delete process.env.MASTYFF_AI_REMOTE_PATH_MAP;
  });

  it('blocks filesystem root', () => {
    expect(evaluatePathGuard(['/']).block).toBe(true);
  });

  it('blocks .ssh paths', () => {
    expect(evaluatePathGuard(['/home/user/.ssh/config']).block).toBe(true);
  });

  it('blocks kubernetes kubeconfig paths', () => {
    expect(evaluatePathGuard(['/root/.kube/config']).block).toBe(true);
    expect(evaluatePathGuard(['.kube/config']).block).toBe(true);
    expect(evaluatePathGuard(['/etc/kubernetes/admin.conf']).block).toBe(true);
  });

  it('scopes to workspace when set', () => {
    process.env.MASTYFF_AI_WORKSPACE = '/workspace/app';
    expect(evaluatePathGuard(['/workspace/app/src/a.ts']).block).toBe(false);
    expect(evaluatePathGuard(['/etc/passwd']).block).toBe(true);
    const outside = evaluatePathGuard(['/tmp/other']);
    expect(outside.block).toBe(true);
  });

  it('translates local paths under Remote SSH workspace map', () => {
    process.env.MASTYFF_AI_REMOTE_SSH = 'true';
    process.env.MASTYFF_AI_REMOTE_PATH_MAP = 'C:/Users/dev/app=/home/vscode/app';
    process.env.MASTYFF_AI_WORKSPACE = 'C:/Users/dev/app';
    expect(evaluatePathGuard(['C:/Users/dev/app/src/a.ts']).block).toBe(false);
    expect(evaluatePathGuard(['C:/Users/dev/other/secret']).block).toBe(true);
  });
});
