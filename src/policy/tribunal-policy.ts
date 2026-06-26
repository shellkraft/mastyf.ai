/**
 * Tribunal SLA settings from policy YAML (M-016). Env vars override policy.
 */
import type { TribunalTimeoutAction } from '../utils/tribunal-sla.js';

export interface TribunalPolicyConfig {
  timeout_ms?: number;
  timeout_action?: TribunalTimeoutAction;
}

let cached: TribunalPolicyConfig | null = null;

export function setTribunalPolicyFromConfig(tribunal?: TribunalPolicyConfig): void {
  cached = tribunal ?? null;
}

export function getTribunalPolicyFromConfig(): TribunalPolicyConfig | null {
  return cached;
}

/** @internal */
export function resetTribunalPolicyForTests(): void {
  cached = null;
}
