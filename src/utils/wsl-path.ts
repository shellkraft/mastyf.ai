/**
 * Windows / WSL2 path normalization for policy path guards.
 * Maps /mnt/c/... and \\wsl$\Distro\... to Windows-style paths when enabled.
 */

function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Convert /mnt/<drive>/... to C:/... */
export function wslMountToWindows(path: string): string | null {
  const norm = normalizeSlashes(path);
  const m = /^\/mnt\/([a-z])\/(.*)$/i.exec(norm);
  if (!m) return null;
  const drive = m[1]!.toUpperCase();
  const rest = m[2]!.replace(/^\/+/, '');
  return `${drive}:/${rest}`;
}

/** Convert \\wsl$\Distro\home\user\... to /home/user/... (Linux side). */
export function wslUncToLinux(path: string): string | null {
  const norm = normalizeSlashes(path);
  const m = /^\/\/wsl\$\/[^/]+\/(.*)$/i.exec(norm) || /^\/wsl\$\/[^/]+\/(.*)$/i.exec(norm);
  if (!m) return null;
  return `/${m[1]!.replace(/^\/+/, '')}`;
}

export function isWslPathMappingEnabled(): boolean {
  return process.env.MASTYFF_AI_WSL_PATH_MAP !== 'false';
}

/**
 * Normalize paths that cross Windows ↔ WSL boundaries before path-guard evaluation.
 */
export function translateWslPath(input: string): string {
  if (!isWslPathMappingEnabled()) return input;

  const trimmed = input.trim();
  if (!trimmed) return input;

  const fromMount = wslMountToWindows(trimmed);
  if (fromMount) return fromMount;

  const fromUnc = wslUncToLinux(trimmed);
  if (fromUnc) return fromUnc;

  return trimmed;
}
