import { dump, load } from 'js-yaml';

type PolicyRule = {
  name: string;
  action: 'pass' | 'block' | 'flag';
  description?: string;
  enabled?: boolean;
  tools?: { allow?: string[]; deny?: string[] };
  patterns?: string[];
  argPatterns?: Array<{ field: string; patterns: string[] }>;
};

type PolicyDoc = {
  policy?: {
    rules?: PolicyRule[];
    [k: string]: unknown;
  };
  [k: string]: unknown;
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

function parseDoc(yaml: string): PolicyDoc {
  const parsed = load(yaml);
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid policy YAML');
  const doc = parsed as PolicyDoc;
  if (!doc.policy || typeof doc.policy !== 'object') throw new Error('Missing policy block');
  if (!Array.isArray(doc.policy.rules)) throw new Error('Missing policy.rules array');
  return doc;
}

function serialize(doc: PolicyDoc): string {
  return dump(doc, { noRefs: true, lineWidth: -1 });
}

export function summarizeRules(yaml: string): ActiveRuleSummary[] {
  const doc = parseDoc(yaml);
  return (doc.policy?.rules ?? []).map((rule) => ({
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

export function setRuleEnabled(yaml: string, name: string, enabled: boolean): string {
  const doc = parseDoc(yaml);
  const rules = doc.policy?.rules ?? [];
  const idx = rules.findIndex((rule) => rule.name === name);
  if (idx < 0) throw new Error(`Rule not found: ${name}`);
  rules[idx] = { ...rules[idx], enabled };
  return serialize(doc);
}

export function removeRule(yaml: string, name: string): string {
  const doc = parseDoc(yaml);
  const rules = doc.policy?.rules ?? [];
  const nextRules = rules.filter((rule) => rule.name !== name);
  if (nextRules.length === rules.length) throw new Error(`Rule not found: ${name}`);
  doc.policy = { ...(doc.policy ?? {}), rules: nextRules };
  return serialize(doc);
}

