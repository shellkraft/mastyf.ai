/**
 * Circuit breaker for semantic LLM calls — opens after consecutive failures.
 */
import { Gauge } from 'prom-client';
import { registry } from '../utils/metrics.js';
import { Logger } from '../utils/logger.js';

const THRESHOLD = parseInt(process.env.MASTYFF_AI_SEMANTIC_CIRCUIT_THRESHOLD || '5', 10);
const RESET_MS = parseInt(process.env.MASTYFF_AI_SEMANTIC_CIRCUIT_RESET_MS || '60000', 10);

let consecutiveFailures = 0;
let openUntil = 0;

const circuitOpenGauge = new Gauge({
  name: 'mastyff_ai_semantic_circuit_open',
  help: '1 when semantic LLM circuit breaker is open',
  registers: [registry],
});

export function isSemanticCircuitOpen(): boolean {
  if (Date.now() < openUntil) {
    circuitOpenGauge.set(1);
    return true;
  }
  circuitOpenGauge.set(0);
  return false;
}

export function recordSemanticLlmSuccess(): void {
  consecutiveFailures = 0;
  openUntil = 0;
  circuitOpenGauge.set(0);
}

export function recordSemanticLlmFailure(err?: unknown): void {
  consecutiveFailures++;
  if (consecutiveFailures >= THRESHOLD) {
    openUntil = Date.now() + RESET_MS;
    circuitOpenGauge.set(1);
    const detail = err instanceof Error ? err.message : '';
    Logger.warn(
      `[semantic-circuit] Open for ${RESET_MS}ms after ${consecutiveFailures} failures${detail ? `: ${detail}` : ''}`,
    );
  }
}

/** @internal */
export function resetSemanticCircuitForTests(): void {
  consecutiveFailures = 0;
  openUntil = 0;
  circuitOpenGauge.set(0);
}
