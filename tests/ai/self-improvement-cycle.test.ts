import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SelfImprovement } from '../../src/ai/self-improvement.js';

describe('SelfImprovement.recordCycleComplete', () => {
  it('persists learning state to disk', () => {
    const dir = mkdtempSync(join(tmpdir(), 'guardian-ai-'));
    const path = join(dir, '.ai-learning.json');
    const engine = new SelfImprovement(path);
    engine.recordCycleComplete({
      recordsAnalyzed: 21,
      baselinesLearned: 4,
      suggestionsGenerated: 2,
    });
    expect(existsSync(path)).toBe(true);
    const st = JSON.parse(readFileSync(path, 'utf-8'));
    expect(st.learningInitialized).toBe(true);
    expect(st.recordsAnalyzed).toBe(21);
    expect(st.baselinesLearned).toBe(4);
    expect(st.cyclesCompleted).toBe(1);
  });
});
