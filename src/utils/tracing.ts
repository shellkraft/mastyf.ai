import { context, propagation, trace, SpanStatusCode } from '@opentelemetry/api';
import { Logger } from './logger.js';

/**
 * OpenTelemetry tracing for distributed request tracking across proxy → upstream.
 * Enable with: OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
 */
export async function initTracing(): Promise<void> {
  if (!process.env['OTEL_EXPORTER_OTLP_ENDPOINT']) {
    Logger.debug('[tracing] OpenTelemetry not configured (set OTEL_EXPORTER_OTLP_ENDPOINT)');
    return;
  }

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');

    const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT']!;
    const url = endpoint.endsWith('/v1/traces') ? endpoint : `${endpoint}/v1/traces`;
    const exporter = new OTLPTraceExporter({ url }) as any;

    const instruments = getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': { enabled: true },
    }) as any;

    const sdk = new NodeSDK({
      serviceName: process.env['OTEL_SERVICE_NAME'] || 'mastyf-ai',
      traceExporter: exporter,
      instrumentations: [instruments],
    });

    await sdk.start();
    Logger.info('[tracing] OpenTelemetry tracing initialized — exporting to OTLP HTTP endpoint');
  } catch (err: unknown) {
    Logger.warn(`[tracing] OpenTelemetry initialization failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function injectTraceHeaders(headers: Record<string, string>): Record<string, string> {
  const carrier: Record<string, string> = { ...headers };
  propagation.inject(context.active(), carrier);
  return carrier;
}

export function extractTraceContext(headers: Record<string, string | string[] | undefined>): void {
  const carrier: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === 'string') carrier[k.toLowerCase()] = v;
    else if (Array.isArray(v) && v[0]) carrier[k.toLowerCase()] = v[0];
  }
  propagation.extract(context.active(), carrier);
}

export async function withToolCallSpan<T>(
  name: string,
  attrs: Record<string, string | number>,
  fn: () => Promise<T>,
): Promise<T> {
  const tracer = trace.getTracer('mastyf-ai-proxy');
  return tracer.startActiveSpan(name, { attributes: attrs }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      span.end();
    }
  });
}
