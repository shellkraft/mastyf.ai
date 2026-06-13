/** Unified upstream MCP / HTTP timeout for proxy transports. */
export function getUpstreamTimeoutMs(): number {
  const raw = process.env.MASTYFF_AI_UPSTREAM_TIMEOUT_MS;
  if (raw == null || raw === '') return 30_000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 30_000;
}
