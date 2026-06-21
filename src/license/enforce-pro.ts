/**
 * Legacy license gate — removed. All features are MIT open source.
 */
import type { ProFeature } from './feature-tiers.js';

export function formatProRequiredMessage(_feature: string): string {
  return 'All mastyf.ai features are MIT open source — no license key required.';
}

export async function ensureProFeature(_feature: ProFeature | string): Promise<void> {
  return;
}

export async function exitUnlessProFeature(_feature: ProFeature | string): Promise<void> {
  return;
}

export function assertProFeatureStarted(_feature: ProFeature | string): void {
  return;
}

export class ProLicenseRequiredError extends Error {
  readonly feature: string;

  constructor(feature: string) {
    super(`Feature unavailable: ${feature}`);
    this.name = 'ProLicenseRequiredError';
    this.feature = feature;
  }
}

/** CLI entry: node dist/license/check-pro.js <feature> — always succeeds. */
export async function runCheckProCli(_argv: string[] = process.argv.slice(2)): Promise<number> {
  return 0;
}
