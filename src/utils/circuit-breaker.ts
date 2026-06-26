/**
 * Circuit Breaker for MCP Proxy Server.
 * Implements the classic 3-state circuit breaker pattern:
 * CLOSED → OPEN → HALF_OPEN → CLOSED (or OPEN again).
 *
 * Used to protect upstream MCP servers from cascading failures.
 */
import { Logger } from './logger.js';
import { saveCircuitToRedis } from './redis-circuit-sync.js';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  /** True while a HALF_OPEN probe is in flight — only one probe allowed. */
  private probing = false;
  /** Timestamp when the circuit first transitioned to OPEN (used for recovery timer) */
  private openedAt: number = 0;
  private openCycles: number = 0;
  private currentProbeTimeout: number;
  private readonly resetTimeout: number;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly name: string;

  constructor(
    name: string,
    options: { failureThreshold?: number; successThreshold?: number; resetTimeoutMs?: number } = {}
  ) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.resetTimeout = options.resetTimeoutMs || 30000;
    this.currentProbeTimeout = this.resetTimeout;
  }

  private maxProbeInterval(): number {
    return parseInt(process.env['MASTYF_AI_CIRCUIT_MAX_PROBE_INTERVAL_MS'] || '300000', 10);
  }

  private nextProbeTimeout(): number {
    const base = this.resetTimeout * Math.pow(2, Math.max(0, this.openCycles - 1));
    const capped = Math.min(base, this.maxProbeInterval());
    const jitter = capped * 0.1 * (Math.random() * 2 - 1);
    return Math.round(capped + jitter);
  }

  /** Check if the circuit allows a request through */
  allowRequest(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (Date.now() - this.openedAt >= this.currentProbeTimeout) {
        this.state = 'HALF_OPEN';
        this.probing = false;
        Logger.debug(`[circuit-breaker:${this.name}] Transitioned to HALF_OPEN`);
      } else {
        return false;
      }
    }
    if (this.state === 'HALF_OPEN') {
      if (this.probing) return false;
      this.probing = true;
      return true;
    }
    return true;
  }

  /** Record a successful request */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.probing = false;
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.openCycles = 0;
        this.currentProbeTimeout = this.resetTimeout;
        Logger.info(`[circuit-breaker:${this.name}] Circuit CLOSED — service healthy`);
        this.syncRedis();
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  /** Record a failed request */
  recordFailure(): void {
    if (this.state === 'HALF_OPEN') {
      this.probing = false;
      this.state = 'OPEN';
      this.successCount = 0;
      this.openCycles += 1;
      this.currentProbeTimeout = this.nextProbeTimeout();
      this.openedAt = Date.now();
      Logger.warn(`[circuit-breaker:${this.name}] Circuit OPEN — half-open probe failed (probe wait ${this.currentProbeTimeout}ms)`);
      this.notifyCircuitOpen('half-open probe failed');
      this.syncRedis();
    } else if (this.state === 'CLOSED') {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
        this.openCycles = Math.max(1, this.openCycles + 1);
        this.currentProbeTimeout =
          this.openCycles <= 1 ? this.resetTimeout : this.nextProbeTimeout();
        this.openedAt = Date.now();
        Logger.warn(`[circuit-breaker:${this.name}] Circuit OPEN — ${this.failureCount} consecutive failures (probe wait ${this.currentProbeTimeout}ms)`);
        this.notifyCircuitOpen(`${this.failureCount} consecutive failures`);
        this.syncRedis();
      }
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): { state: CircuitState; failureCount: number; successCount: number } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
    };
  }

  /** Force circuit open (incident isolation). */
  forceOpen(reason?: string): void {
    this.state = 'OPEN';
    this.openedAt = Date.now();
    this.failureCount = this.failureThreshold;
    Logger.warn(`[circuit-breaker:${this.name}] Circuit force-opened${reason ? `: ${reason}` : ''}`);
    this.notifyCircuitOpen(reason || 'force-opened');
    this.syncRedis();
  }

  private notifyCircuitOpen(detail: string): void {
    void import('../alerting/webhook-alerter.js').then(({ sendAlert }) =>
      sendAlert({
        severity: 'warning',
        title: `Circuit open: ${this.name}`,
        message: detail,
        serverName: this.name,
      }),
    ).catch(() => undefined);
  }

  private syncRedis(): void {
    void saveCircuitToRedis(this.name, {
      state: this.state,
      failureCount: this.failureCount,
      openedAt: this.openedAt,
    });
  }

  /** Hydrate from Redis snapshot (multi-replica). */
  applyRedisSnapshot(snap: { state: CircuitState; failureCount: number; openedAt: number }): void {
    this.state = snap.state;
    this.failureCount = snap.failureCount;
    this.openedAt = snap.openedAt;
  }
}