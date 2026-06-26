/**
 * Loop / perturbation evasion guard — semantic similarity + high-frequency anomaly detection.
 */
import type { CallContext, PolicyDecision } from './policy-types.js';
import { getFlowHistorySync } from './session-flow-store.js';
import { flowSessionKey } from './session-flow-guard.js';

const SIMILARITY_THRESHOLD = (): number => {
  const n = parseFloat(process.env['MASTYF_AI_LOOP_SIMILARITY_THRESHOLD'] || '0.82');
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0.82;
};

const BURST_WINDOW_MS = (): number => {
  const n = parseInt(process.env['MASTYF_AI_LOOP_BURST_WINDOW_MS'] || '10000', 10);
  return Number.isFinite(n) && n > 0 ? n : 10_000;
};

const BURST_MAX_SIMILAR = (): number => {
  const n = parseInt(process.env['MASTYF_AI_LOOP_BURST_MAX_SIMILAR'] || '8', 10);
  return Number.isFinite(n) && n > 0 ? n : 8;
};

function normalizePayload(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.toLowerCase().replace(/\s+/g, ' ').trim();
  try {
    return JSON.stringify(value).toLowerCase().replace(/\s+/g, ' ').trim();
  } catch {
    return String(value).toLowerCase();
  }
}

function tokenSet(text: string): Set<string> {
  return new Set(text.split(/[^a-z0-9]+/i).filter((t) => t.length >= 2));
}

/** Jaccard similarity on token sets (robust to small perturbations). */
export function payloadSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const sa = tokenSet(a);
  const sb = tokenSet(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) {
    if (sb.has(t)) inter++;
  }
  const union = sa.size + sb.size - inter;
  return union > 0 ? inter / union : 0;
}

export function fingerprintArguments(args: Record<string, unknown> | undefined): string {
  return normalizePayload(args ?? {});
}

export function evaluateLoopAnomalyGuard(ctx: CallContext): PolicyDecision | null {
  const sessionKey = flowSessionKey(ctx);
  const history = getFlowHistorySync(sessionKey);
  const currentFp = fingerprintArguments(ctx.arguments);
  if (!currentFp) return null;

  const now = Date.now();
  const threshold = SIMILARITY_THRESHOLD();
  let similarRecent = 0;

  for (const event of history) {
    if (now - event.at > BURST_WINDOW_MS()) continue;
    const priorFp = event.argFingerprint || fingerprintArguments(event.argumentsSnapshot);
    if (payloadSimilarity(currentFp, priorFp) >= threshold) {
      similarRecent++;
    }
  }

  if (similarRecent >= BURST_MAX_SIMILAR()) {
    return {
      action: 'block',
      rule: 'loop-anomaly-perturbation',
      reason: `High-frequency semantically similar tool calls (${similarRecent + 1} in ${BURST_WINDOW_MS()}ms window)`,
    };
  }

  return null;
}
