import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SelfImprovement } from '../../src/ai/self-improvement.js';

describe('learning anti-poisoning quorum', () => {
  let tempDir: string;
  let statePath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'guardian-quorum-'));
    statePath = join(tempDir, '.ai-learning.json');
    process.env.GUARDIAN_AI_STATE_PATH = statePath;
    process.env.GUARDIAN_AI_SNAPSHOT_DIR = join(tempDir, 'learning-snapshots');
    process.env.GUARDIAN_AI_MIN_DISTINCT_LABELERS = '2';
    process.env.GUARDIAN_AI_MIN_TOTAL_LABELS = '10';
    process.env.GUARDIAN_AI_LABEL_WEIGHT = '1';
    delete process.env.GUARDIAN_AI_ADMIN_USERS;
  });

  afterEach(() => {
    delete process.env.GUARDIAN_AI_STATE_PATH;
    delete process.env.GUARDIAN_AI_SNAPSHOT_DIR;
    delete process.env.GUARDIAN_AI_MIN_DISTINCT_LABELERS;
    delete process.env.GUARDIAN_AI_MIN_TOTAL_LABELS;
    rmSync(tempDir, { recursive: true, force: true });
  });

  function outcome(ruleName: string, action: 'applied' | 'rejected' = 'applied') {
    return {
      suggestionId: `s-${ruleName}`,
      ruleName,
      source: 'baseline' as const,
      action,
      confidence: 0.9,
      timestamp: new Date().toISOString(),
    };
  }

  it('5 same-user accepts do not change adaptiveThreshold', () => {
    const engine = new SelfImprovement(statePath);
    const initial = engine.getAdaptiveThreshold();

    for (let i = 0; i < 5; i++) {
      const { quorumApplied } = engine.recordOutcome(outcome('rate-limit-read'), { userId: 'attacker-1' });
      expect(quorumApplied).toBe(false);
    }

    expect(engine.getAdaptiveThreshold()).toBe(initial);
    const st = engine.getState();
    expect(st.outcomes.length).toBe(5);
    expect(st.outcomes.every((o) => o.quorumApplied === false)).toBe(true);
  });

  it('2 distinct users plus 10 labels apply learning and adjust threshold', () => {
    const engine = new SelfImprovement(statePath);
    const initial = engine.getAdaptiveThreshold();
    let appliedCount = 0;

    for (let i = 0; i < 10; i++) {
      const userId = i % 2 === 0 ? 'analyst-a' : 'analyst-b';
      const { quorumApplied } = engine.recordOutcome(outcome('benign-read'), { userId });
      if (quorumApplied) appliedCount++;
    }

    expect(appliedCount).toBeGreaterThan(0);
    expect(engine.getAdaptiveThreshold()).toBeLessThan(initial);
  });

  it('blocks dangerous curl unblock without quorum', () => {
    const engine = new SelfImprovement(statePath);
    const initial = engine.getAdaptiveThreshold();

    const { quorumApplied } = engine.recordOutcome(
      outcome('allow-curl-exec', 'applied'),
      { userId: 'solo', pattern: 'curl\\s' },
    );
    expect(quorumApplied).toBe(false);
    expect(engine.getAdaptiveThreshold()).toBe(initial);
  });
});
