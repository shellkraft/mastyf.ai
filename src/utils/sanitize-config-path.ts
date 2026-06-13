import { realpathSync } from 'fs';
import { homedir, platform, tmpdir } from 'os';
import { resolve as pathResolve } from 'path';
import { Logger } from './logger.js';

function comparePath(p: string): string {
  const resolved = pathResolve(p);
  return platform() === 'win32' ? resolved.toLowerCase() : resolved;
}

function resolvedTempPrefix(): string {
  try {
    return comparePath(realpathSync(tmpdir()));
  } catch {
    return comparePath(tmpdir());
  }
}

function unixAllowedPrefixes(home: string, cwd: string): string[] {
  const temp = resolvedTempPrefix();
  return [
    home,
    cwd,
    temp,
    '/tmp/',
    '/var/',
    '/etc/',
    '/opt/',
    '/home/',
    '/root/',
    '/srv/',
    '/data/',
    '/Users/',
    '/github/workspace/',
    '/runner/',
  ].map(comparePath);
}

function winAllowedPrefixes(home: string, cwd: string): string[] {
  const roots = ['c:\\', 'd:\\', process.env['PROGRAMDATA'], process.env['PUBLIC']]
    .filter((r): r is string => Boolean(r))
    .map((r) => comparePath(r.endsWith('\\') ? r : `${r}\\`));
  return [comparePath(home), comparePath(cwd), ...roots];
}

function isUnderAllowedPrefix(resolved: string, prefixes: string[]): boolean {
  const norm = comparePath(resolved);
  const withSep = norm.endsWith('\\') || norm.endsWith('/') ? norm : `${norm}${platform() === 'win32' ? '\\' : '/'}`;
  return prefixes.some((prefix) => {
    if (norm === prefix.replace(/[\\/]+$/, '')) return true;
    const p = prefix.endsWith('\\') || prefix.endsWith('/') ? prefix : `${prefix}${platform() === 'win32' ? '\\' : '/'}`;
    return withSep.startsWith(p) || norm.startsWith(prefix);
  });
}

/**
 * Sanitise user-supplied configPath to prevent path-traversal and symlink escape.
 * Resolves symlinks via realpath; allows home, CWD, and common MCP/CI locations.
 */
export function sanitizeConfigPath(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  if (input.includes('..')) {
    Logger.warn(`[mastyff-ai] Path-traversal attempt blocked: ${input}`);
    return null;
  }

  let resolved: string;
  try {
    resolved = realpathSync(pathResolve(input));
  } catch {
    Logger.warn(`[mastyff-ai] Config path does not exist or is inaccessible: ${input}`);
    return null;
  }

  const home = pathResolve(homedir());
  const cwd = pathResolve('.');
  const prefixes = platform() === 'win32' ? winAllowedPrefixes(home, cwd) : unixAllowedPrefixes(home, cwd);

  if (isUnderAllowedPrefix(resolved, prefixes)) {
    return resolved;
  }

  Logger.warn(`[mastyff-ai] Config path rejected (outside allowed directories): ${input}`);
  return null;
}
