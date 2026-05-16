/**
 * Filesystem path guard for tool arguments — blocks sensitive paths and optional workspace scoping.
 */
const PATH_ARG_FIELDS = new Set(['path', 'file', 'filepath', 'file_path', 'directory', 'dir']);

/** Paths that must never be read/list even when tools are allowlisted. */
const SENSITIVE_PATH_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/etc(?:\/|$)/,
  /^\/root(?:\/|$)/,
  /^\/proc(?:\/|$)/,
  /^\/sys(?:\/|$)/,
  /\/\.ssh(?:\/|$)/,
  /\/\.aws\/credentials$/,
  /\/\.env(?:\.|$)/,
  /(?:^|\/)id_rsa(?:\.|$)/,
  /(?:^|\/)authorized_keys$/,
  /\/\.gnupg(?:\/|$)/,
  /\/\.kube(?:\/|$)/,
  /\/\.docker(?:\/|$)/,
  /(?:^|\/)passwd$/,
  /(?:^|\/)shadow$/,
];

export function extractPathArgumentValues(args: Record<string, unknown> | undefined): string[] {
  if (!args) return [];
  const values: string[] = [];
  for (const [key, val] of Object.entries(args)) {
    if (!PATH_ARG_FIELDS.has(key.toLowerCase())) continue;
    if (typeof val === 'string') values.push(val);
  }
  return values;
}

function allowedPathPrefixes(): string[] {
  const prefixes: string[] = [];
  const workspace = process.env.GUARDIAN_WORKSPACE?.trim();
  if (workspace) prefixes.push(workspace);
  const list = process.env.GUARDIAN_ALLOWED_PATH_PREFIXES?.split(',').map((s) => s.trim()).filter(Boolean);
  if (list?.length) prefixes.push(...list);
  return prefixes;
}

function isUnderPrefix(path: string, prefix: string): boolean {
  const normPath = path.replace(/\\/g, '/');
  const normPrefix = prefix.replace(/\\/g, '/').replace(/\/+$/, '');
  if (!normPrefix) return false;
  return normPath === normPrefix || normPath.startsWith(`${normPrefix}/`);
}

export interface PathGuardResult {
  block: boolean;
  reason?: string;
}

export function evaluatePathGuard(paths: string[]): PathGuardResult {
  for (const raw of paths) {
    const path = raw.replace(/\\/g, '/');

    for (const pattern of SENSITIVE_PATH_PATTERNS) {
      if (pattern.test(path)) {
        return {
          block: true,
          reason: `Sensitive path blocked: ${path}`,
        };
      }
    }

    const prefixes = allowedPathPrefixes();
    if (prefixes.length > 0 && !prefixes.some((p) => isUnderPrefix(path, p))) {
      return {
        block: true,
        reason: `Path outside allowed workspace: ${path} (allowed: ${prefixes.join(', ')})`,
      };
    }
  }
  return { block: false };
}
