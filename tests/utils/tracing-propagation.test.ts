import { beforeAll, describe, it, expect } from 'vitest';
import { propagation, trace } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import { injectTraceHeaders } from '../../src/utils/tracing.js';
import { runWithExtractedTrace, injectIntoUpstreamHeaders } from '../../src/proxy/trace-context.js';

const SAMPLE_TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

describe('tracing propagation', () => {
  beforeAll(() => {
    const provider = new BasicTracerProvider();
    trace.setGlobalTracerProvider(provider);
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());
  });

  it('passes inbound traceparent through injectTraceHeaders fallback', () => {
    const outbound = injectTraceHeaders({ traceparent: SAMPLE_TRACEPARENT });
    expect(outbound.traceparent).toBe(SAMPLE_TRACEPARENT);
  });

  it('round-trips extracted inbound traceparent through runWithExtractedTrace', () => {
    const outbound: Record<string, string> = {};
    runWithExtractedTrace({ traceparent: SAMPLE_TRACEPARENT }, () => {
      Object.assign(outbound, injectTraceHeaders({ traceparent: SAMPLE_TRACEPARENT }));
    });
    expect(outbound.traceparent).toBe(SAMPLE_TRACEPARENT);
  });

  it('merges trace headers into upstream request headers', () => {
    const merged = injectIntoUpstreamHeaders({
      'Content-Type': 'application/json',
      traceparent: SAMPLE_TRACEPARENT,
      host: 'upstream.local',
    });
    expect(merged['Content-Type']).toBe('application/json');
    expect(String(merged.traceparent || '')).toBe(SAMPLE_TRACEPARENT);
  });
});
