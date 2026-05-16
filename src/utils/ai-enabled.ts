/**
 * AI learning & suggestion engine feature flags (enterprise defaults).
 *
 * Learning is ON unless GUARDIAN_AI_ENABLED=false.
 * Auto-apply of generated rules is OFF unless GUARDIAN_AI_AUTO_APPLY=true.
 */
export function isAiLearningEnabled(): boolean {
  if (process.env.GUARDIAN_AI_ENABLED === 'false') return false;
  if (process.env.GUARDIAN_AI_ENABLED === 'true') return true;
  // Legacy alias
  if (process.env.GUARDIAN_EXPERIMENTAL_AI === 'true') return true;
  // Enterprise default: learning enabled
  return true;
}

export function isAiAutoApplyEnabled(): boolean {
  return process.env.GUARDIAN_AI_AUTO_APPLY === 'true'
    || process.env.GUARDIAN_EXPERIMENTAL_AI === 'true';
}

/** @deprecated Use isAiLearningEnabled */
export function isExperimentalAiEnabled(): boolean {
  return isAiLearningEnabled();
}

/** Learning on scan/audit/health CLI is opt-in (proxy/report hooks still respect GUARDIAN_AI_ENABLED). */
export function isAiLearningOnCliCommands(): boolean {
  return process.env.GUARDIAN_AI_ON_CLI === 'true';
}
