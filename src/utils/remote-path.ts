/**
 * VS Code Remote SSH path mapping — translate local IDE paths to remote workspace paths.
 */

export interface PathMapping {
  local: string;
  remote: string;
}

function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, '/');
}

function parsePairSegment(segment: string): PathMapping | null {
  const trimmed = segment.trim();
  if (!trimmed) return null;
  const eq = trimmed.indexOf('=');
  if (eq <= 0) return null;
  const local = trimmed.slice(0, eq).trim();
  const remote = trimmed.slice(eq + 1).trim();
  if (!local || !remote) return null;
  return { local: normalizeSlashes(local), remote: normalizeSlashes(remote) };
}

/** Parse MASTYFF_AI_REMOTE_PATH_MAP (JSON object or `local=/remote` comma-separated pairs). */
export function parseRemotePathMap(raw?: string): PathMapping[] {
  const source = raw ?? process.env.MASTYFF_AI_REMOTE_PATH_MAP ?? '';
  if (!source.trim()) return [];

  const trimmed = source.trim();
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, string>;
      return Object.entries(obj).map(([local, remote]) => ({
        local: normalizeSlashes(local),
        remote: normalizeSlashes(remote),
      }));
    } catch {
      return [];
    }
  }

  return trimmed
    .split(/[,;]/)
    .map(parsePairSegment)
    .filter((m): m is PathMapping => m !== null);
}

export function isRemoteSshEnabled(): boolean {
  return process.env.MASTYFF_AI_REMOTE_SSH === 'true';
}

function longestPrefixMatch(path: string, mappings: PathMapping[]): PathMapping | null {
  let best: PathMapping | null = null;
  let bestLen = -1;
  for (const m of mappings) {
    const local = m.local.replace(/\/+$/, '');
    if (path === local || path.startsWith(`${local}/`)) {
      if (local.length > bestLen) {
        best = m;
        bestLen = local.length;
      }
    }
  }
  return best;
}

/**
 * Map a local IDE path to its remote counterpart when Remote SSH is enabled.
 * Unmapped paths are returned unchanged (normalized to forward slashes).
 */
export function translatePath(localPath: string): string {
  const normalized = normalizeSlashes(localPath);
  if (!isRemoteSshEnabled()) return normalized;

  const mappings = parseRemotePathMap();
  const match = longestPrefixMatch(normalized, mappings);
  if (!match) return normalized;

  const localBase = match.local.replace(/\/+$/, '');
  const suffix = normalized.length > localBase.length ? normalized.slice(localBase.length) : '';
  const remoteBase = match.remote.replace(/\/+$/, '');
  return `${remoteBase}${suffix}`;
}

/** Apply translatePath to workspace / prefix env values used in policy checks. */
export function translatePathIfRemote(path: string): string {
  return translatePath(path);
}
