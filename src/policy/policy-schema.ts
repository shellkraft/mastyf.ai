/**
 * Zod schema validation for MCP Guardian policy YAML files.
 *
 * Fix 6: Policy YAML schema validation — typo in YAML now raises an error
 * at load time instead of silently disabling a rule.
 */
import { z } from 'zod';

const RuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required'),
  description: z.string().optional(),
  action: z.enum(['block', 'flag', 'pass'], {
    errorMap: () => ({ message: 'action must be one of: block, flag, pass' }),
  }),
  tools: z.object({
    allow: z.array(z.string()).optional(),
    deny: z.array(z.string()).optional(),
  }).optional(),
  patterns: z.array(z.string()).optional().refine(
    (patterns) => {
      if (!patterns) return true;
      for (const p of patterns) {
        try { new RegExp(p); } catch { return false; }
      }
      return true;
    },
    { message: 'One or more regex patterns are invalid JavaScript RegExp literals' }
  ),
  argPatterns: z.array(z.object({
    field: z.string(),
    patterns: z.array(z.string()),
  })).optional(),
  toolCategories: z.object({
    deny: z.array(z.string()),
  }).optional(),
  toolAllowExceptions: z.array(z.string()).optional(),
  maxTokens: z.number().int().positive().optional(),
  maxCallsPerMinute: z.number().int().positive().optional(),
  rbac: z.object({
    scopes: z.array(z.string()).optional(),
    clientIds: z.array(z.string()).optional(),
  }).optional(),
  inspectResponses: z.boolean().optional(),
  maxPayloadBytes: z.number().int().positive().optional(),
});

export const PolicyFileSchema = z.object({
  version: z.string().default('1.0'),
  policy: z.object({
    mode: z.enum(['audit', 'warn', 'block'], {
      errorMap: () => ({ message: 'policy.mode must be one of: audit, warn, block' }),
    }),
    rules: z.array(RuleSchema).default([]),
  }),
});

export type PolicyFile = z.infer<typeof PolicyFileSchema>;

/**
 * Validate a raw policy object (parsed from YAML) against the schema.
 * Throws a descriptive Error on invalid input.
 */
export function validatePolicy(raw: unknown): PolicyFile {
  const result = PolicyFileSchema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Policy validation failed:\n${errors}`);
  }
  return result.data;
}