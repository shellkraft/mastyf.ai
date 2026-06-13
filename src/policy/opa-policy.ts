/**
 * Optional OPA/Rego policy evaluation (enterprise).
 * Enable with: OPA_URL=http://localhost:8181/v1/data/mastyff_ai
 *
 * Precedence: OPA block wins over YAML; OPA allow (or no decision) falls through to YAML.
 * LRU cache: (tenantId, serverName, toolName, argsHash) — MASTYFF_AI_OPA_CACHE_TTL_MS (default 5000).
 */
import { createHash } from 'crypto';
import { LRUCache } from 'lru-cache';
import { CallContext, PolicyDecision } from './policy-types.js';
import { Logger } from '../utils/logger.js';

type OpaCacheEntry = { decision: PolicyDecision | null; expiresAt: number };

const opaCache = new LRUCache<string, OpaCacheEntry>({ max: 1000 });

function opaCacheTtlMs(): number {
  const n = parseInt(process.env['MASTYFF_AI_OPA_CACHE_TTL_MS'] || '5000', 10);
  return Number.isFinite(n) && n >= 0 ? n : 5000;
}

function argsHash(args: unknown): string {
  try {
    return createHash('sha256').update(JSON.stringify(args ?? {})).digest('hex').slice(0, 16);
  } catch {
    return '0';
  }
}

function cacheKey(ctx: CallContext): string {
  const tenant = ctx.tenantId || 'default';
  return `${tenant}:${ctx.serverName}:${ctx.toolName}:${argsHash(ctx.arguments)}`;
}

export function resetOpaCacheForTests(): void {
  opaCache.clear();
}

/** Validate OPA decision document: { allow: boolean, reason?: string }. */
export function parseOpaResult(
  result: unknown,
): { ok: true; allow: boolean; reason?: string } | { ok: false; error: string } {
  if (result == null || typeof result !== 'object') {
    return { ok: false, error: 'result is not an object' };
  }
  const r = result as Record<string, unknown>;
  if (typeof r.allow !== 'boolean') {
    return { ok: false, error: 'allow must be boolean' };
  }
  if (r.reason != null && typeof r.reason !== 'string') {
    return { ok: false, error: 'reason must be string when present' };
  }
  return { ok: true, allow: r.allow, reason: r.reason as string | undefined };
}

/** Returns a block decision only — never a pass. YAML runs when this returns null. */
export async function evaluateOpaPolicy(ctx: CallContext): Promise<PolicyDecision | null> {
  const opaUrl = process.env['OPA_URL'];
  if (!opaUrl) return null;

  const key = cacheKey(ctx);
  const ttl = opaCacheTtlMs();
  if (ttl > 0) {
    const hit = opaCache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.decision;
    }
  }

  let decision: PolicyDecision | null = null;
  try {
    const res = await fetch(opaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: ctx }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      Logger.warn(`[opa] evaluation failed: HTTP ${res.status}`);
      decision = null;
    } else {
      const data = (await res.json()) as { result?: unknown };
      const parsed = parseOpaResult(data.result);
      if (!parsed.ok) {
        Logger.warn(`[opa] invalid result shape: ${parsed.error}`);
        decision = process.env['MASTYFF_AI_STRICT_MODE'] === 'true'
          ? { action: 'block', rule: 'opa', reason: 'OPA returned invalid result shape' }
          : null;
      } else if (parsed.allow === false) {
        decision = {
          action: 'block',
          rule: 'opa',
          reason: parsed.reason || 'Denied by OPA policy',
        };
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    Logger.warn(`[opa] unreachable: ${message}`);
    if (process.env['MASTYFF_AI_STRICT_MODE'] === 'true') {
      decision = { action: 'block', rule: 'opa', reason: 'OPA unreachable in strict mode' };
    }
  }

  if (ttl > 0 && decision !== null) {
    opaCache.set(key, { decision, expiresAt: Date.now() + ttl });
  }
  return decision;
}
