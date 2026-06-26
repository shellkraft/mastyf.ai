import { describe, it, expect, afterEach } from 'vitest';
import {
  isSemanticCircuitOpen,
  tryBeginSemanticLlmProbe,
  abortSemanticLlmProbe,
  recordSemanticLlmFailure,
  recordSemanticLlmSuccess,
  resetSemanticCircuitForTests,
  advanceSemanticCircuitForTests,
  getSemanticCircuitStateForTests,
} from '../../src/ai/semantic-circuit-breaker.js';

describe('semantic-circuit-breaker', () => {
  afterEach(() => {
    resetSemanticCircuitForTests();
    delete process.env.MASTYF_AI_SEMANTIC_CIRCUIT_THRESHOLD;
  });

  it('isolates circuit state per tenant', () => {
    process.env.MASTYF_AI_SEMANTIC_CIRCUIT_THRESHOLD = '2';

    recordSemanticLlmFailure(new Error('a'), 'tenant-a');
    recordSemanticLlmFailure(new Error('b'), 'tenant-a');
    expect(isSemanticCircuitOpen('tenant-a')).toBe(true);
    expect(isSemanticCircuitOpen('tenant-b')).toBe(false);

    recordSemanticLlmSuccess('tenant-a');
    expect(isSemanticCircuitOpen('tenant-a')).toBe(false);
  });

  it('uses default tenant when tenantId omitted', () => {
    process.env.MASTYF_AI_SEMANTIC_CIRCUIT_THRESHOLD = '1';
    recordSemanticLlmFailure(new Error('x'));
    expect(isSemanticCircuitOpen()).toBe(true);
    expect(isSemanticCircuitOpen('default')).toBe(true);
  });

  it('half-open allows one probe after cooldown', () => {
    process.env.MASTYF_AI_SEMANTIC_CIRCUIT_THRESHOLD = '1';
    recordSemanticLlmFailure(new Error('fail'), 'tenant-ho');
    expect(isSemanticCircuitOpen('tenant-ho')).toBe(true);

    advanceSemanticCircuitForTests('tenant-ho');
    expect(getSemanticCircuitStateForTests('tenant-ho').state).toBe('half-open');
    expect(isSemanticCircuitOpen('tenant-ho')).toBe(false);
    expect(tryBeginSemanticLlmProbe('tenant-ho')).toBe(true);
    expect(isSemanticCircuitOpen('tenant-ho')).toBe(true);
    expect(tryBeginSemanticLlmProbe('tenant-ho')).toBe(false);
  });

  it('half-open probe success closes circuit', () => {
    process.env.MASTYF_AI_SEMANTIC_CIRCUIT_THRESHOLD = '1';
    recordSemanticLlmFailure(new Error('fail'), 'tenant-ok');
    advanceSemanticCircuitForTests('tenant-ok');
    expect(tryBeginSemanticLlmProbe('tenant-ok')).toBe(true);
    recordSemanticLlmSuccess('tenant-ok');
    expect(getSemanticCircuitStateForTests('tenant-ok').state).toBe('closed');
    expect(isSemanticCircuitOpen('tenant-ok')).toBe(false);
  });

  it('half-open probe failure re-opens circuit', () => {
    process.env.MASTYF_AI_SEMANTIC_CIRCUIT_THRESHOLD = '1';
    recordSemanticLlmFailure(new Error('fail'), 'tenant-bad');
    advanceSemanticCircuitForTests('tenant-bad');
    expect(tryBeginSemanticLlmProbe('tenant-bad')).toBe(true);
    recordSemanticLlmFailure(new Error('probe fail'), 'tenant-bad');
    expect(getSemanticCircuitStateForTests('tenant-bad').state).toBe('open');
    expect(isSemanticCircuitOpen('tenant-bad')).toBe(true);
  });

  it('abortSemanticLlmProbe releases half-open reservation', () => {
    process.env.MASTYF_AI_SEMANTIC_CIRCUIT_THRESHOLD = '1';
    recordSemanticLlmFailure(new Error('fail'), 'tenant-abort');
    advanceSemanticCircuitForTests('tenant-abort');
    expect(tryBeginSemanticLlmProbe('tenant-abort')).toBe(true);
    abortSemanticLlmProbe('tenant-abort');
    expect(isSemanticCircuitOpen('tenant-abort')).toBe(false);
    expect(tryBeginSemanticLlmProbe('tenant-abort')).toBe(true);
  });
});
