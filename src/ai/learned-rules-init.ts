/**
 * Bootstrap learned-rules overlay at proxy startup.
 */
import {
  reloadLearnedRules,
  startLearnedRulesReloadTimer,
  getLearnedRulesStats,
} from '@mastyf-ai/core';
import { Logger } from '../utils/logger.js';

let stopReload: (() => void) | null = null;

export function bootstrapLearnedRules(): void {
  if (process.env.MASTYF_AI_LEARNED_RULES_ENABLED !== 'true') {
    return;
  }

  reloadLearnedRules();
  stopReload = startLearnedRulesReloadTimer();
  const stats = getLearnedRulesStats();
  Logger.info(
    `[bootstrap] Learned rules overlay enabled (${stats.total} rules: ${stats.argument} argument, ${stats.localSemantic} local-semantic)`,
  );
}

export function shutdownLearnedRules(): void {
  stopReload?.();
  stopReload = null;
}
