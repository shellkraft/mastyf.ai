/**
 * Normalize OAuth scope / scp claims into a deduplicated token list.
 */
export function extractJwtScopes(payload: Record<string, unknown>): string[] | undefined {
  const tokens = new Set<string>();

  const add = (raw: unknown) => {
    if (raw == null) return;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string' && item.trim()) tokens.add(item.trim().toLowerCase());
      }
      return;
    }
    if (typeof raw === 'string') {
      for (const part of raw.split(/\s+/)) {
        if (part.trim()) tokens.add(part.trim().toLowerCase());
      }
    }
  };

  add(payload.scope);
  add(payload.scp);

  if (tokens.size === 0) return undefined;
  return [...tokens];
}
