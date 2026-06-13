/**
 * Per-tool request timeouts (enterprise).
 * MASTYFF_AI_TOOL_TIMEOUT_JSON='{"slow_query":120000,"read_file":10000}'
 */
const DEFAULT_MS = parseInt(process.env['MASTYFF_AI_REQUEST_TIMEOUT_MS'] || '30000', 10) || 30_000;

let cache: Record<string, number> | null = null;

function loadMap(): Record<string, number> {
  if (cache) return cache;
  cache = {};
  const raw = process.env['MASTYFF_AI_TOOL_TIMEOUT_JSON'];
  if (!raw) return cache;
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && v > 0) cache[k] = v;
    }
  } catch {
    cache = {};
  }
  return cache;
}

export function resolveToolTimeoutMs(toolName: string, fallbackMs = DEFAULT_MS): number {
  const map = loadMap();
  return map[toolName] ?? fallbackMs;
}
