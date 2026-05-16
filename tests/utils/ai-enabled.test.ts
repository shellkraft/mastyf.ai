import { describe, it, expect, afterEach } from 'vitest';
import { isAiLearningEnabled, isAiAutoApplyEnabled } from '../../src/utils/ai-enabled.js';

describe('ai-enabled', () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it('learning enabled by default', () => {
    delete process.env.GUARDIAN_AI_ENABLED;
    delete process.env.GUARDIAN_EXPERIMENTAL_AI;
    expect(isAiLearningEnabled()).toBe(true);
  });

  it('learning disabled when GUARDIAN_AI_ENABLED=false', () => {
    process.env.GUARDIAN_AI_ENABLED = 'false';
    expect(isAiLearningEnabled()).toBe(false);
  });

  it('auto-apply off by default', () => {
    delete process.env.GUARDIAN_AI_AUTO_APPLY;
    delete process.env.GUARDIAN_EXPERIMENTAL_AI;
    expect(isAiAutoApplyEnabled()).toBe(false);
  });
});
