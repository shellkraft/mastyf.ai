import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { PolicyWatcher } from '../../src/policy/policy-watcher.js';
import { sharedRateLimitStore } from '../../src/policy/rate-limit-store.js';
import type { CallContext } from '../../src/policy/policy-types.js';

const baseYaml = `version: "1.0"
policy:
  mode: block
  rules:
    - name: deny-eval
      action: block
      tools:
        deny: [eval]
`;

describe('PolicyWatcher hot reload', () => {
  let dir: string;
  let policyPath: string;
  let watcher: PolicyWatcher | null = null;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mastyff-ai-policy-'));
    policyPath = join(dir, 'policy.yaml');
    writeFileSync(policyPath, baseYaml, 'utf-8');
    watcher = new PolicyWatcher(policyPath);
  });

  afterEach(() => {
    watcher?.close();
    rmSync(dir, { recursive: true, force: true });
    sharedRateLimitStore.resetForTests();
  });

  it('evaluate during reload never returns reload-in-progress block', async () => {
    const ctx = {
      serverName: 's',
      toolName: 'eval',
      arguments: {},
      requestId: 'r1',
      requestTokens: 1,
      timestamp: new Date().toISOString(),
    };

    writeFileSync(
      policyPath,
      baseYaml.replace('deny: [eval]', 'deny: [eval, execute_command]'),
      'utf-8',
    );
    await watcher!.forceReloadForTests();

    const decisions = await Promise.all(
      Array.from({ length: 50 }, async () => {
        await new Promise((r) => setImmediate(r));
        const engine = watcher!.get();
        if (!engine) return { action: 'pass' as const, rule: 'none', reason: '' };
        return engine.evaluate(ctx);
      }),
    );

    for (const d of decisions) {
      expect(d.reason?.toLowerCase() ?? '').not.toMatch(/reload/);
      expect(d.rule).not.toBe('reload-in-progress');
    }
    expect(decisions.some((d) => d.action === 'block')).toBe(true);
  });

  it('atomically swaps engine after file change', async () => {
    const before = watcher!.get()!;
    writeFileSync(
      policyPath,
      `version: "1.0"
policy:
  mode: audit
  rules: []
`,
      'utf-8',
    );

    await watcher!.forceReloadForTests();
    const after = watcher!.get()!;
    expect(after).not.toBe(before);
    expect(after.getMode()).toBe('audit');
  });

  it('preserves rate-limit counters across hot reload', async () => {
    const rateYaml = `version: "1.0"
policy:
  mode: block
  rules:
    - name: rate-test
      action: block
      maxCallsPerMinute: 2
      tools:
        allow: [rate-reload-tool]
`;
    writeFileSync(policyPath, rateYaml, 'utf-8');
    watcher = new PolicyWatcher(policyPath);
    const engine1 = watcher.get()!;
    const ctx: CallContext = {
      serverName: 'rate-reload-server',
      toolName: 'rate-reload-tool',
      arguments: {},
      requestId: 'rl-1',
      requestTokens: 1,
      timestamp: new Date().toISOString(),
      agentIdentity: { sub: 'client-a', issuer: 'https://issuer' },
    };
    expect(engine1.evaluate(ctx).action).toBe('pass');
    expect(engine1.evaluate(ctx).action).toBe('pass');

    const key = 'default:rate-reload-server:rate-reload-tool:client-a';
    expect(sharedRateLimitStore.call().get(key)?.count).toBe(2);

    writeFileSync(
      policyPath,
      rateYaml.replace('maxCallsPerMinute: 2', 'maxCallsPerMinute: 5'),
      'utf-8',
    );
    await watcher.forceReloadForTests();
    const engine2 = watcher.get()!;
    expect(sharedRateLimitStore.call().get(key)?.count).toBe(2);
    expect(engine2.evaluate(ctx).action).toBe('pass');
  });
});
