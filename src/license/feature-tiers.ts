/**
 * Open-core feature tiers — Community (free on npm) vs Pro (paid license).
 */

import { Logger } from '../utils/logger.js';
import { resolveProCheckoutUrl } from './pro-checkout-url.js';

export const PRO_FEATURES = [
  'dashboard',
  'websocket',
  'swarm',
  'ai',
  'audit',
  'metrics',
  'cost',
  'health',
  'fleet',
  'admin',
  'multi_tenant',
  'semantic_async',
  'policy', // cloud policy sync via control plane
] as const;

export type ProFeature = (typeof PRO_FEATURES)[number];

const PRO_FEATURE_SET = new Set<string>(PRO_FEATURES);

/** Community tier — always available without a license. */
export const COMMUNITY_FEATURES = ['proxy', 'cli', 'policy_local'] as const;

let warnedOpenCoreFalse = false;

/** v3+: Pro gates always apply. GUARDIAN_OPEN_CORE=false is ignored (use GUARDIAN_DEV_UNLOCK_ALL in development). */
export function isOpenCoreEnabled(): boolean {
  if (process.env['GUARDIAN_OPEN_CORE'] === 'false') {
    if (!warnedOpenCoreFalse) {
      warnedOpenCoreFalse = true;
      Logger.warn(
        '[license] GUARDIAN_OPEN_CORE=false is deprecated in v3.0 — Pro gates remain active. ' +
          'For local development only, set NODE_ENV=development and GUARDIAN_DEV_UNLOCK_ALL=true',
      );
    }
  }
  return true;
}

/** CI / repo automation only — set in .github/workflows, not for end users. */
export function isCiLicenseBypass(): boolean {
  return process.env['GUARDIAN_CI_BYPASS_LICENSE'] === 'true';
}

/** Maintainer local unlock — never use in production. */
export function isDevUnlockAllowed(): boolean {
  return (
    process.env['NODE_ENV'] === 'development'
    && process.env['GUARDIAN_DEV_UNLOCK_ALL'] === 'true'
  );
}

export function isProFeature(feature: string): boolean {
  return PRO_FEATURE_SET.has(feature);
}

export function allProFeatureNames(): ProFeature[] {
  return [...PRO_FEATURES];
}

export function getProCheckoutUrl(): string {
  return resolveProCheckoutUrl();
}

export function licenseTier(licensed: boolean): 'community' | 'pro' {
  if (isDevUnlockAllowed() || isCiLicenseBypass()) return 'pro';
  return licensed ? 'pro' : 'community';
}
