/**
 * Per-tenant circuit breaker for semantic LLM calls — isolates failure domains.
 */
import { Gauge } from 'prom-client';
import { registry } from '../utils/metrics.js';
import { Logger } from '../utils/logger.js';
import { DEFAULT_TENANT_ID } from '../tenant/resolve-tenant.js';

const RESET_MS = parseInt(process.env.MASTYF_AI_SEMANTIC_CIRCUIT_RESET_MS || '60000', 10);

function failureThreshold(): number {
  const n = parseInt(process.env.MASTYF_AI_SEMANTIC_CIRCUIT_THRESHOLD || '5', 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

type CircuitState = 'closed' | 'open' | 'half-open';

type TenantCircuit = {
  state: CircuitState;
  consecutiveFailures: number;
  openUntil: number;
  halfOpenProbeInFlight: boolean;
};

const circuits = new Map<string, TenantCircuit>();

const circuitOpenGauge = new Gauge({
  name: 'mastyf_ai_semantic_circuit_open',
  help: '1 when semantic LLM circuit breaker is open for a tenant',
  labelNames: ['tenant_id'],
  registers: [registry],
});

function tenantKey(tenantId?: string): string {
  const id = tenantId?.trim();
  return id && id.length > 0 ? id : DEFAULT_TENANT_ID;
}

function newCircuit(): TenantCircuit {
  return {
    state: 'closed',
    consecutiveFailures: 0,
    openUntil: 0,
    halfOpenProbeInFlight: false,
  };
}

function getCircuit(tenantId?: string): TenantCircuit {
  const key = tenantKey(tenantId);
  let circuit = circuits.get(key);
  if (!circuit) {
    circuit = newCircuit();
    circuits.set(key, circuit);
  }
  return circuit;
}

function tickCircuit(tenantId?: string): void {
  const circuit = getCircuit(tenantId);
  if (circuit.state === 'open' && Date.now() >= circuit.openUntil) {
    circuit.state = 'half-open';
    circuit.halfOpenProbeInFlight = false;
  }
}

function syncGauge(tenantId?: string): void {
  const key = tenantKey(tenantId);
  const circuit = getCircuit(tenantId);
  tickCircuit(tenantId);
  const blocking = circuit.state === 'open'
    || (circuit.state === 'half-open' && circuit.halfOpenProbeInFlight);
  circuitOpenGauge.set({ tenant_id: key }, blocking ? 1 : 0);
}

/** True when semantic LLM work should be skipped (open, or half-open probe already in flight). */
export function isSemanticCircuitOpen(tenantId?: string): boolean {
  tickCircuit(tenantId);
  const circuit = getCircuit(tenantId);
  if (circuit.state === 'open') return true;
  if (circuit.state === 'half-open' && circuit.halfOpenProbeInFlight) return true;
  syncGauge(tenantId);
  return false;
}

/**
 * Reserve a semantic LLM call slot. Returns false when open or half-open probe in flight.
 */
export function tryBeginSemanticLlmProbe(tenantId?: string): boolean {
  tickCircuit(tenantId);
  const circuit = getCircuit(tenantId);
  if (circuit.state === 'open') return false;
  if (circuit.state === 'half-open') {
    if (circuit.halfOpenProbeInFlight) return false;
    circuit.halfOpenProbeInFlight = true;
  }
  syncGauge(tenantId);
  return true;
}

/** Release half-open probe reservation when LLM call is aborted before completion. */
export function abortSemanticLlmProbe(tenantId?: string): void {
  const circuit = getCircuit(tenantId);
  if (circuit.state === 'half-open' && circuit.halfOpenProbeInFlight) {
    circuit.halfOpenProbeInFlight = false;
    syncGauge(tenantId);
  }
}

export function recordSemanticLlmSuccess(tenantId?: string): void {
  const circuit = getCircuit(tenantId);
  tickCircuit(tenantId);
  if (circuit.state === 'half-open') {
    circuit.state = 'closed';
    circuit.consecutiveFailures = 0;
    circuit.openUntil = 0;
    circuit.halfOpenProbeInFlight = false;
    syncGauge(tenantId);
    return;
  }
  circuit.consecutiveFailures = 0;
  circuit.openUntil = 0;
  syncGauge(tenantId);
}

export function recordSemanticLlmFailure(err?: unknown, tenantId?: string): void {
  const circuit = getCircuit(tenantId);
  tickCircuit(tenantId);
  if (circuit.state === 'half-open') {
    circuit.state = 'open';
    circuit.openUntil = Date.now() + RESET_MS;
    circuit.halfOpenProbeInFlight = false;
    syncGauge(tenantId);
    const detail = err instanceof Error ? err.message : '';
    Logger.warn(
      `[semantic-circuit] Re-opened for tenant ${tenantKey(tenantId)} after half-open probe failure`
      + `${detail ? `: ${detail}` : ''}`,
    );
    return;
  }
  circuit.consecutiveFailures++;
  if (circuit.consecutiveFailures >= failureThreshold()) {
    circuit.state = 'open';
    circuit.openUntil = Date.now() + RESET_MS;
    syncGauge(tenantId);
    const detail = err instanceof Error ? err.message : '';
    Logger.warn(
      `[semantic-circuit] Open for tenant ${tenantKey(tenantId)} `
      + `for ${RESET_MS}ms after ${circuit.consecutiveFailures} failures`
      + `${detail ? `: ${detail}` : ''}`,
    );
    return;
  }
  syncGauge(tenantId);
}

/** @internal */
export function getSemanticCircuitStateForTests(tenantId?: string): {
  state: CircuitState;
  consecutiveFailures: number;
  halfOpenProbeInFlight: boolean;
} {
  tickCircuit(tenantId);
  const circuit = getCircuit(tenantId);
  return {
    state: circuit.state,
    consecutiveFailures: circuit.consecutiveFailures,
    halfOpenProbeInFlight: circuit.halfOpenProbeInFlight,
  };
}

/** @internal — advance open → half-open without waiting for RESET_MS */
export function advanceSemanticCircuitForTests(tenantId?: string): void {
  const circuit = getCircuit(tenantId);
  if (circuit.state === 'open') {
    circuit.openUntil = 0;
    tickCircuit(tenantId);
  }
}

/** @internal */
export function resetSemanticCircuitForTests(): void {
  circuits.clear();
  circuitOpenGauge.reset();
}
