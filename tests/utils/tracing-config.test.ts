import { afterEach, describe, expect, it } from 'vitest';
import {
  isTracingEnabled,
  isTracingInitialized,
  resolveOtlpTracesEndpoint,
} from '../../src/utils/tracing.js';

describe('tracing config', () => {
  const envBackup = { ...process.env };

  afterEach(() => {
    process.env = { ...envBackup };
  });

  it('is disabled without OTLP endpoint', () => {
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
    expect(isTracingEnabled()).toBe(false);
    expect(resolveOtlpTracesEndpoint()).toBeNull();
  });

  it('respects OTEL_ENABLED=false', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
    process.env.OTEL_ENABLED = 'false';
    expect(isTracingEnabled()).toBe(false);
  });

  it('resolves dedicated traces endpoint', () => {
    process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = 'http://collector:4318/v1/traces';
    expect(resolveOtlpTracesEndpoint()).toBe('http://collector:4318/v1/traces');
  });

  it('appends /v1/traces to base OTLP endpoint', () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318/';
    expect(resolveOtlpTracesEndpoint()).toBe('http://localhost:4318/v1/traces');
  });

  it('reports uninitialized before initTracing', () => {
    expect(isTracingInitialized()).toBe(false);
  });
});
