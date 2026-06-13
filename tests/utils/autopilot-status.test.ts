import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { buildAutopilotStatus } from '../../src/utils/autopilot-status.js';
import {
  writeAutopilotConfig,
  defaultAutopilotConfig,
  autopilotConfigPath,
} from '../../src/utils/autopilot-config.js';
import { resetThreatResearchQueueForTests } from '../../src/ai/threat-research-pipeline.js';

const TEST_DIR = join(process.cwd(), 'reports', 'tenants', 'test-autopilot-status');

describe('buildAutopilotStatus', () => {
  beforeEach(() => {
    resetThreatResearchQueueForTests();
    mkdirSync(TEST_DIR, { recursive: true });
    process.env.MASTYFF_AI_AUTOPILOT_CONFIG_PATH = join(TEST_DIR, 'autopilot.json');
    writeAutopilotConfig(defaultAutopilotConfig('default'));
    process.env.MASTYFF_AI_AUTOPILOT = 'true';
    process.env.MASTYFF_AI_AI_AUTO_APPLY = 'false';
  });

  afterEach(() => {
    delete process.env.MASTYFF_AI_AUTOPILOT;
    delete process.env.MASTYFF_AI_AUTOPILOT_CONFIG_PATH;
    const p = autopilotConfigPath();
    if (existsSync(p)) rmSync(p, { force: true });
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('returns autopilot enabled and human-review message', async () => {
    const status = await buildAutopilotStatus('default', false);
    expect(status.autopilotEnabled).toBe(true);
    expect(status.messages.some((m) => m.includes('approval'))).toBe(true);
    expect(status.protection.policyAutoApply).toBe(false);
  });

  it('counts pending suggestions from file', async () => {
    const dir = join(TEST_DIR, 'data');
    mkdirSync(dir, { recursive: true });
    const sugPath = join(dir, '.ai-pending-suggestions.json');
    process.env.MASTYFF_AI_AI_SUGGESTIONS_PATH = sugPath;
    writeFileSync(
      sugPath,
      JSON.stringify({ suggestions: [{ id: '1' }, { id: '2' }] }),
    );
    const status = await buildAutopilotStatus('default', true);
    expect(status.learning.pendingSuggestions).toBe(2);
    delete process.env.MASTYFF_AI_AI_SUGGESTIONS_PATH;
  });
});
