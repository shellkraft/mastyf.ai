import { context, propagation } from '@opentelemetry/api';
import type { IncomingHttpHeaders } from 'http';
import { injectTraceHeaders, withToolCallSpan } from '../utils/tracing.js';

export type TraceTransport = 'http' | 'sse' | 'streamable-http' | 'stdio' | 'websocket';

function headersToCarrier(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const carrier: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === 'string') carrier[k.toLowerCase()] = v;
    else if (Array.isArray(v) && v[0]) carrier[k.toLowerCase()] = v[0];
  }
  return carrier;
}

/** Run fn with W3C trace context extracted from inbound HTTP headers. */
export function runWithExtractedTrace<T>(
  headers: Record<string, string | string[] | undefined> | IncomingHttpHeaders | undefined,
  fn: () => T,
): T {
  const carrier = headersToCarrier((headers ?? {}) as Record<string, string | string[] | undefined>);
  const ctx = propagation.extract(context.active(), carrier);
  return context.with(ctx, fn);
}

/** Async variant of {@link runWithExtractedTrace}. */
export async function runWithExtractedTraceAsync<T>(
  headers: Record<string, string | string[] | undefined> | IncomingHttpHeaders | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  return runWithExtractedTrace(headers, fn);
}

/** Merge traceparent (and related) headers into outbound upstream request headers. */
export function injectIntoUpstreamHeaders(
  headers: Record<string, string | string[] | undefined>,
  overrides: Record<string, string> = {},
): Record<string, string | string[]> {
  const base: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === 'string') base[k.toLowerCase()] = v;
    else if (Array.isArray(v) && v[0]) base[k.toLowerCase()] = v[0];
  }
  const injected = injectTraceHeaders({ ...base, ...overrides });
  return { ...headers, ...injected } as Record<string, string | string[]>;
}

export interface ToolCallSpanAttrs {
  serverName: string;
  toolName: string;
  tenantId?: string;
  transport: TraceTransport;
  decision?: string;
}

/** Active span for MCP tools/call handling (policy + upstream relay). */
export function withMcpToolCallSpan<T>(
  attrs: ToolCallSpanAttrs,
  fn: () => Promise<T>,
): Promise<T> {
  return withToolCallSpan('mcp.tools/call', {
    server_name: attrs.serverName,
    tool_name: attrs.toolName,
    tenant_id: attrs.tenantId ?? 'default',
    transport: attrs.transport,
    ...(attrs.decision ? { decision: attrs.decision } : {}),
  }, fn);
}
