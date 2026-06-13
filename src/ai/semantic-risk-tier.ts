export type SemanticRiskTier = 'low' | 'medium' | 'high';

const DEFAULT_HIGH_RISK = new Set([
  'execute_command',
  'bash',
  'run_shell_command',
  'write_file',
  'edit_file',
  'delete_file',
]);

const DEFAULT_MEDIUM_RISK = new Set([
  'fetch',
  'http_request',
  'search',
]);

export function classifySemanticRiskTier(toolName: string, args: unknown): SemanticRiskTier {
  const lower = toolName.toLowerCase();
  if (DEFAULT_HIGH_RISK.has(lower)) return 'high';
  if (DEFAULT_MEDIUM_RISK.has(lower)) return 'medium';
  const argText = JSON.stringify(args ?? {}).toLowerCase();
  if (argText.includes('/etc/') || argText.includes('base64') || argText.includes('rm -rf')) {
    return 'high';
  }
  return 'low';
}

export function shouldFailClosedOnSemanticDegrade(tier: SemanticRiskTier): boolean {
  if (tier === 'high') return true;
  if (tier === 'medium') return process.env['MASTYFF_AI_SEMANTIC_FAIL_CLOSED_MEDIUM'] === 'true';
  return process.env['MASTYFF_AI_SEMANTIC_FAIL_CLOSED_LOW'] === 'true';
}
