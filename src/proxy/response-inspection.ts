/**
 * Shared tool-response inspection logic for all proxy transports
 * (HTTP, SSE, WebSocket). Centralises response gating, DLP, logging,
 * metrics, redaction-meta injection, and block-response generation.
 */
import { findingsToMessages, isResponseScanSkipped } from '../utils/streaming-inspector.js';
import { gateToolResponseText } from '../utils/response-security-gate.js';
import { injectRedactionMeta } from '../utils/redaction-meta.js';
import { Logger } from '../utils/logger.js';
import { StructuredLogger } from '../utils/structured-logger.js';
import * as Metrics from '../utils/metrics.js';
import type { PolicyEngine } from '../policy/policy-engine.js';

/** Outcome returned to the transport layer after inspecting a tool response. */
export interface ResponseInspectionResult {
  blocked: boolean;
  redacted: boolean;
  /** If blocked, the JSON-RPC error body to return to the client. */
  blockResponse?: Record<string, unknown>;
  /** If redacted, the reasons that triggered redaction. */
  redactionReasons?: string[];
}

/**
 * Inspect a JSON-RPC tool-call response for policy violations, DLP
 * matches, and semantic threats.
 *
 * When the response is redacted the function **mutates** `response.result`
 * in place (all three transports rely on this behaviour).
 */
export async function inspectToolResponse(params: {
  response: Record<string, unknown>;
  toolName: string;
  serverName: string;
  requestId: string | number;
  tenantId?: string;
  policyEngine: PolicyEngine | null | undefined;
  /** Label used in log lines, e.g. "http-proxy", "sse-proxy", "ws-proxy". */
  transportLabel: string;
}): Promise<ResponseInspectionResult> {
  const { response, toolName, serverName, requestId, tenantId, policyEngine, transportLabel } =
    params;

  const result = (response as { result?: unknown }).result;
  if (result == null || isResponseScanSkipped()) {
    return { blocked: false, redacted: false };
  }

  const responseText = JSON.stringify(result);
  const gate = await gateToolResponseText({
    responseText,
    toolName,
    serverName,
    policy: policyEngine,
    requestId,
    tenantId,
  });

  const inspect = gate.inspect;

  // --- Log & record metrics when findings are present ----------------------
  if (inspect && !inspect.clean) {
    const allMessages = findingsToMessages(inspect.findings);
    Logger.warn(
      `[${transportLabel}:${serverName}] Suspicious response from '${toolName}': ${allMessages.slice(0, 5).join('; ')}`,
    );
    StructuredLogger.info({
      event: 'response_flagged',
      serverName,
      toolName,
      detections: allMessages,
      blocked: gate.outcome.action === 'block',
    });
    Metrics.injectionDetectedTotal?.inc({
      server_name: serverName,
      severity: inspect.hasCritical ? 'critical' : 'high',
    });
  }

  // --- Handle redaction ----------------------------------------------------
  if (gate.outcome.action === 'redact' && gate.outcome.body) {
    try {
      const parsed = JSON.parse(gate.outcome.body) as unknown;
      (response as { result: unknown }).result = injectRedactionMeta(
        parsed,
        gate.outcome.redactionReasons,
      );
    } catch {
      /* keep upstream body on parse failure */
    }
    return { blocked: false, redacted: true, redactionReasons: gate.outcome.redactionReasons };
  }

  // --- Handle block --------------------------------------------------------
  if (gate.outcome.action === 'block') {
    return {
      blocked: true,
      redacted: false,
      blockResponse: {
        jsonrpc: '2.0',
        id: requestId,
        error: {
          code: -32002,
          message: gate.outcome.message,
        },
      },
    };
  }

  return { blocked: false, redacted: false };
}
