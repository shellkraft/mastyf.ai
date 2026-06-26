/**
 * Unified cross-provider spend pool — tokens/min, USD/min, USD/day (Redis Lua + in-process fallback).
 *
 * All proxied tool traffic (any upstream model/provider) debits the same tenant pool.
 */
import { getDailyBudgetCapUsd } from './cost-auditor.js';
import { Logger } from '../utils/logger.js';
import { isRedisConfigured, getSharedRedisClient } from '../utils/redis-client.js';
import * as Metrics from '../utils/metrics.js';

const REDIS_DAY_PREFIX = 'mastyf_ai:unified_spend:day:';
const REDIS_TOKENS_MIN_PREFIX = 'mastyf_ai:unified_spend:tokens_min:';
const REDIS_USD_MIN_PREFIX = 'mastyf_ai:unified_spend:usd_min:';

const pendingReserveMicro = new Map<string, number>();

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function ttlSecondsUntilUtcMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.max(60, Math.ceil((tomorrow.getTime() - now.getTime()) / 1000));
}

function getTokensPerMinCap(): number {
  const n = parseInt(process.env['MASTYF_AI_TENANT_TOKENS_PER_MIN'] || '500000', 10);
  return Number.isFinite(n) && n > 0 ? n : 500_000;
}

function getUsdPerMinCap(tenantId: string): number {
  const raw = process.env['MASTYF_AI_TENANT_USD_PER_MIN'];
  if (raw) {
    const n = parseFloat(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const perTenant = process.env['MASTYF_AI_TENANT_USD_PER_MIN_JSON'];
  if (perTenant) {
    try {
      const map = JSON.parse(perTenant) as Record<string, number>;
      const v = map[tenantId];
      if (typeof v === 'number' && v > 0) return v;
    } catch {
      // ignore
    }
  }
  return 0;
}

export interface ReserveSpendInput {
  tenantId?: string;
  sessionKey?: string;
  tokens: number;
  estimatedUsd: number;
}

export interface ReserveSpendResult {
  ok: boolean;
  rule?: string;
  reason?: string;
}

function dayKey(tenantId: string): string {
  return `${REDIS_DAY_PREFIX}${utcDayKey()}:${tenantId}`;
}

function tokensMinKey(tenantId: string, sessionKey?: string): string {
  const suffix = sessionKey ? `${tenantId}:${sessionKey}` : tenantId;
  return `${REDIS_TOKENS_MIN_PREFIX}${suffix}`;
}

function usdMinKey(tenantId: string): string {
  return `${REDIS_USD_MIN_PREFIX}${tenantId}`;
}

const localDaySpend = new Map<string, number>();
const localTokensMin = new Map<string, { count: number; resetAt: number }>();
const localUsdMin = new Map<string, { usd: number; resetAt: number }>();

export async function tryReserveSpend(input: ReserveSpendInput): Promise<ReserveSpendResult> {
  const tid = input.tenantId?.trim() || 'default';
  const tokens = Math.max(0, Math.floor(input.tokens || 0));
  const estimatedUsd = Math.max(0, input.estimatedUsd || 0);
  const tokensCap = getTokensPerMinCap();
  const usdMinCap = getUsdPerMinCap(tid);
  const dayCap = getDailyBudgetCapUsd(tid);

  if (tokensCap > 0 && tokens > tokensCap) {
    return {
      ok: false,
      rule: 'unified-spend-pool',
      reason: `Single request tokens ${tokens} exceed per-minute cap ${tokensCap}`,
    };
  }

  if (isRedisConfigured()) {
    try {
      const redis = getSharedRedisClient();
      const tKey = tokensMinKey(tid, input.sessionKey);
      const uKey = usdMinKey(tid);
      const dKey = dayKey(tid);

      if (tokens > 0 && tokensCap > 0) {
        const tokScript = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local cap = tonumber(ARGV[1])
local delta = tonumber(ARGV[2])
if current + delta > cap then return 0 end
redis.call('INCRBY', KEYS[1], delta)
redis.call('EXPIRE', KEYS[1], 60)
return 1`;
        const tokOk = await redis.eval(tokScript, 1, tKey, tokensCap, tokens);
        if (tokOk !== 1) {
          return { ok: false, rule: 'token-budget-per-minute', reason: 'Tenant tokens per minute exceeded' };
        }
      }

      if (estimatedUsd > 0 && usdMinCap > 0) {
        const micro = Math.ceil(estimatedUsd * 1_000_000);
        const capMicro = Math.ceil(usdMinCap * 1_000_000);
        const usdScript = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local cap = tonumber(ARGV[1])
local delta = tonumber(ARGV[2])
if current + delta > cap then return 0 end
redis.call('INCRBY', KEYS[1], delta)
redis.call('EXPIRE', KEYS[1], 60)
return 1`;
        const usdOk = await redis.eval(usdScript, 1, uKey, capMicro, micro);
        if (usdOk !== 1) {
          return { ok: false, rule: 'usd-budget-per-minute', reason: 'Tenant USD per minute exceeded' };
        }
      }

      if (estimatedUsd > 0 && dayCap > 0) {
        const micro = Math.ceil(estimatedUsd * 1_000_000);
        const capMicro = Math.ceil(dayCap * 1_000_000);
        const dayScript = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local cap = tonumber(ARGV[1])
local delta = tonumber(ARGV[2])
if current + delta > cap then return 0 end
redis.call('INCRBY', KEYS[1], delta)
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1`;
        const dayOk = await redis.eval(dayScript, 1, dKey, capMicro, micro, ttlSecondsUntilUtcMidnight());
        if (dayOk !== 1) {
          return { ok: false, rule: 'unified-spend-pool', reason: 'Tenant daily USD cap exceeded' };
        }
      }

      if (estimatedUsd > 0) {
        pendingReserveMicro.set(tid, (pendingReserveMicro.get(tid) ?? 0) + Math.ceil(estimatedUsd * 1_000_000));
      }
      refreshSpendGauges(tid, tokens);
      return { ok: true };
    } catch (err: unknown) {
      if (process.env['MASTYF_AI_STRICT_MODE'] === 'true') {
        Logger.error(`[unified-spend-pool] Redis reserve failed: ${err instanceof Error ? err.message : String(err)}`);
        return { ok: false, rule: 'unified-spend-pool', reason: 'Spend pool unavailable' };
      }
    }
  }

  const now = Date.now();
  if (tokens > 0 && tokensCap > 0) {
    const k = tokensMinKey(tid, input.sessionKey);
    let b = localTokensMin.get(k);
    if (!b || now >= b.resetAt) b = { count: 0, resetAt: now + 60_000 };
    if (b.count + tokens > tokensCap) {
      return { ok: false, rule: 'token-budget-per-minute', reason: 'Tenant tokens per minute exceeded' };
    }
    b.count += tokens;
    localTokensMin.set(k, b);
  }

  if (estimatedUsd > 0 && usdMinCap > 0) {
    const k = usdMinKey(tid);
    let b = localUsdMin.get(k);
    if (!b || now >= b.resetAt) b = { usd: 0, resetAt: now + 60_000 };
    if (b.usd + estimatedUsd > usdMinCap) {
      return { ok: false, rule: 'usd-budget-per-minute', reason: 'Tenant USD per minute exceeded' };
    }
    b.usd += estimatedUsd;
    localUsdMin.set(k, b);
  }

  if (estimatedUsd > 0 && dayCap > 0) {
    const dk = `${utcDayKey()}:${tid}`;
    const spent = localDaySpend.get(dk) ?? 0;
    if (spent + estimatedUsd > dayCap) {
      return { ok: false, rule: 'unified-spend-pool', reason: 'Tenant daily USD cap exceeded' };
    }
    localDaySpend.set(dk, spent + estimatedUsd);
  }

  refreshSpendGauges(tid, tokens);
  return { ok: true };
}

export async function recordActualSpend(
  tenantId: string | undefined,
  actualUsd: number,
  reservedUsd: number,
): Promise<void> {
  const tid = tenantId?.trim() || 'default';
  const delta = actualUsd - reservedUsd;
  if (Math.abs(delta) < 0.000001) return;

  if (isRedisConfigured() && delta !== 0) {
    try {
      const redis = getSharedRedisClient();
      const micro = Math.ceil(delta * 1_000_000);
      await redis.incrby(dayKey(tid), micro);
      await redis.expire(dayKey(tid), ttlSecondsUntilUtcMidnight());
    } catch {
      // best-effort reconcile
    }
  }
  const dk = `${utcDayKey()}:${tid}`;
  localDaySpend.set(dk, (localDaySpend.get(dk) ?? 0) + actualUsd);
  pendingReserveMicro.delete(tid);
}

function refreshSpendGauges(tenantId: string, tokensAdded: number): void {
  const dayCap = getDailyBudgetCapUsd(tenantId);
  const dk = `${utcDayKey()}:${tenantId}`;
  const spent = localDaySpend.get(dk) ?? 0;
  Metrics.tenantSpendUsdDayRatio.set(dayCap > 0 ? Math.min(1, spent / dayCap) : 0);
  if (tokensAdded > 0) {
    Metrics.tenantTokensPerMin.set({ tenant_id: tenantId }, tokensAdded);
  }
}

/** @internal tests */
export function resetUnifiedSpendPoolForTests(): void {
  localDaySpend.clear();
  localTokensMin.clear();
  localUsdMin.clear();
  pendingReserveMicro.clear();
}
