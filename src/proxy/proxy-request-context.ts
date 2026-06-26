/**
 * Per-request state for stdio proxy — keyed by JSON-RPC id (concurrent tools/call safe).
 */
import {
  captureEphemeralSecrets,
  runWithEphemeralCredentialVault,
} from '../security/ephemeral-credential-vault.js';
import { releaseReservedSpend } from '../services/unified-spend-pool.js';

export interface ProxyRequestContext {
  requestStartTime: number;
  createdAt: number;
  requestToolName: string;
  requestMethod?: string;
  requestTokens: number;
  requestRaw: string;
  requestModel?: string;
  requestArguments?: Record<string, unknown>;
  sessionId?: string;
  agentId?: string;
  /** Resolved tenant for per-tenant circuit breaker / audit isolation */
  tenantId?: string;
  agentIdentity?: import('../auth/auth-types.js').AgentIdentity;
  /** Rotated MCP session token (L-6) returned to client in response _meta */
  rotatedSessionToken?: string;
  /** Geo region from inbound HTTP headers */
  geoRegion?: string;
  hourUtc?: number;
  /** Unified spend pool reservation — release on block/error, commit on persist */
  spendReservationId?: string;
}

export function proxyContextTtlMs(defaultTimeoutMs: number): number {
  const raw = process.env['MASTYF_AI_PROXY_CONTEXT_TTL_MS'];
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return Math.max(defaultTimeoutMs * 2, defaultTimeoutMs + 5_000);
}

/** Release unified spend pool reservation without awaiting (best-effort). */
export function releaseSpendReservation(ctx: ProxyRequestContext | undefined): void {
  const id = ctx?.spendReservationId;
  if (!id) return;
  ctx!.spendReservationId = undefined;
  void releaseReservedSpend(id);
}

type TimeoutHandler = (id: string | number, ctx: ProxyRequestContext) => void;

export class ProxyRequestContextStore {
  private pending = new Map<string | number, ProxyRequestContext>();
  private timers = new Map<string | number, ReturnType<typeof setTimeout>>();

  set(id: string | number, ctx: ProxyRequestContext): void {
    this.pending.set(id, ctx);
  }

  get(id: string | number): ProxyRequestContext | undefined {
    return this.pending.get(id);
  }

  delete(id: string | number, releaseSpend = true): ProxyRequestContext | undefined {
    this.clearTimeout(id);
    const ctx = this.pending.get(id);
    if (ctx) {
      this.pending.delete(id);
      if (releaseSpend) releaseSpendReservation(ctx);
    }
    return ctx;
  }

  clear(releaseSpend = true): void {
    for (const id of [...this.pending.keys()]) {
      this.delete(id, releaseSpend);
    }
  }

  get size(): number {
    return this.pending.size;
  }

  armTimeout(
    id: string | number,
    ms: number,
    onExpire: TimeoutHandler,
  ): void {
    this.clearTimeout(id);
    const timer = setTimeout(() => {
      this.timers.delete(id);
      const ctx = this.pending.get(id);
      if (ctx) onExpire(id, ctx);
    }, ms);
    if (typeof timer.unref === 'function') timer.unref();
    this.timers.set(id, timer);
  }

  clearTimeout(id: string | number): void {
    const t = this.timers.get(id);
    if (t) {
      clearTimeout(t);
      this.timers.delete(id);
    }
  }

  clearAllTimeouts(): void {
    for (const id of [...this.timers.keys()]) {
      this.clearTimeout(id);
    }
  }

  evictExpired(maxAgeMs: number, onExpire: TimeoutHandler): number {
    const now = Date.now();
    let evicted = 0;
    for (const [id, ctx] of [...this.pending.entries()]) {
      const age = now - (ctx.createdAt ?? ctx.requestStartTime);
      if (age > maxAgeMs) {
        onExpire(id, ctx);
        evicted++;
      }
    }
    return evicted;
  }

  drain(onEach: (id: string | number, ctx: ProxyRequestContext) => void): void {
    for (const [id, ctx] of [...this.pending.entries()]) {
      onEach(id, ctx);
    }
  }

  ids(): Array<string | number> {
    return [...this.pending.keys()];
  }
}

/** Capture provider-shaped secrets from request body/headers for log redaction (in-flight only). */
export function captureRequestSecrets(
  body?: string,
  headers?: Record<string, string | string[] | undefined>,
): void {
  if (body) captureEphemeralSecrets(body);
  if (!headers) return;
  const auth = headers['authorization'];
  const authVal = Array.isArray(auth) ? auth.join(' ') : auth;
  if (authVal) captureEphemeralSecrets(authVal);
  const apiKey = headers['x-api-key'];
  const keyVal = Array.isArray(apiKey) ? apiKey.join(' ') : apiKey;
  if (keyVal) captureEphemeralSecrets(keyVal);
}

/** Scope ephemeral credential vault to a single proxy request lifecycle. */
export function withProxyRequestVault<T>(
  body: string | undefined,
  headers: Record<string, string | string[] | undefined> | undefined,
  fn: () => T,
): T {
  return runWithEphemeralCredentialVault(() => {
    captureRequestSecrets(body, headers);
    return fn();
  });
}
