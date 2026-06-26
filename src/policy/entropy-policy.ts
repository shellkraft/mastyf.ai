/**
 * Per-tool / per-field entropy overrides from policy YAML (M-004).
 */
import type { PolicyConfig } from './policy-types.js';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT_SHAPE = /^eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;

export interface EntropyFieldOverride {
  min_entropy?: number;
  allow_patterns?: string[];
}

export interface EntropyPolicyConfig {
  default_min?: number;
  safe_patterns?: string[];
  tools?: Record<string, { fields?: Record<string, EntropyFieldOverride> }>;
}

let activeEntropyPolicy: EntropyPolicyConfig | null = null;

export function setActiveEntropyPolicy(config: PolicyConfig | null): void {
  const raw = (config?.policy as { entropy?: EntropyPolicyConfig })?.entropy;
  activeEntropyPolicy = raw ?? null;
}

function builtInSafeMatch(value: string, pattern: string): boolean {
  if (pattern === 'uuid-v4' || pattern === 'uuid') return UUID_V4.test(value);
  if (pattern === 'jwt') return JWT_SHAPE.test(value);
  return false;
}

export function isEntropySafeValue(
  value: string,
  toolName?: string,
  fieldName?: string,
): boolean {
  const policy = activeEntropyPolicy;
  const patterns = new Set<string>(policy?.safe_patterns ?? []);

  if (toolName && fieldName && policy?.tools?.[toolName]?.fields?.[fieldName]?.allow_patterns) {
    for (const p of policy.tools[toolName]!.fields![fieldName]!.allow_patterns!) {
      patterns.add(p);
    }
  }

  for (const p of patterns) {
    if (builtInSafeMatch(value, p)) return true;
    try {
      if (new RegExp(p).test(value)) return true;
    } catch {
      /* invalid regex in policy — skip */
    }
  }
  return false;
}

export function minEntropyForContext(toolName?: string, fieldName?: string): number | undefined {
  const policy = activeEntropyPolicy;
  if (toolName && fieldName) {
    const field = policy?.tools?.[toolName]?.fields?.[fieldName];
    if (field?.min_entropy !== undefined) return field.min_entropy;
  }
  return policy?.default_min;
}
