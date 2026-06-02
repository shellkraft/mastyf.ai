import { dump, load } from 'js-yaml';

export type MutablePolicyRule = {
  name: string;
  action: 'pass' | 'block' | 'flag';
  description?: string;
  enabled?: boolean;
  tools?: { allow?: string[]; deny?: string[] };
  patterns?: string[];
  argPatterns?: Array<{ field: string; patterns: string[] }>;
};

export type ActiveRuleSummary = {
  name: string;
  action: 'pass' | 'block' | 'flag';
  enabled: boolean;
  description?: string;
  allowCount: number;
  denyCount: number;
  patternCount: number;
  argPatternCount: number;
};

type PolicyDoc = {
  version?: string;
  policy?: {
    mode?: string;
    rules?: MutablePolicyRule[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

function parsePolicyDoc(yaml: string): PolicyDoc {
  const parsed = load(yaml);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid policy YAML');
  const doc = parsed as PolicyDoc;
  if (!doc.policy || typeof doc.policy !== 'object') throw new Error('Missing policy block');
  if (!Array.isArray(doc.policy.rules)) throw new Error('Missing policy.rules array');
  return doc;
}

function dumpPolicyDoc(doc: PolicyDoc): string {
  return dump(doc, { noRefs: true, lineWidth: -1 });
}

export function listActiveRules(yaml: string): ActiveRuleSummary[] {
  const doc = parsePolicyDoc(yaml);
  const rules = doc.policy?.rules ?? [];
  return rules.map((rule) => ({
    name: rule.name,
    action: rule.action,
    enabled: rule.enabled !== false,
    description: rule.description,
    allowCount: rule.tools?.allow?.length ?? 0,
    denyCount: rule.tools?.deny?.length ?? 0,
    patternCount: rule.patterns?.length ?? 0,
    argPatternCount: rule.argPatterns?.length ?? 0,
  }));
}

export function togglePolicyRule(yaml: string, ruleName: string, enabled: boolean): string {
  const doc = parsePolicyDoc(yaml);
  const rules = doc.policy?.rules ?? [];
  const idx = rules.findIndex((r) => r.name === ruleName);
  if (idx < 0) throw new Error(`Rule not found: ${ruleName}`);
  rules[idx] = { ...rules[idx], enabled };
  return dumpPolicyDoc(doc);
}

export function deletePolicyRule(yaml: string, ruleName: string): string {
  const doc = parsePolicyDoc(yaml);
  const rules = doc.policy?.rules ?? [];
  const next = rules.filter((r) => r.name !== ruleName);
  if (next.length === rules.length) throw new Error(`Rule not found: ${ruleName}`);
  doc.policy = { ...(doc.policy ?? {}), rules: next };
  return dumpPolicyDoc(doc);
}

