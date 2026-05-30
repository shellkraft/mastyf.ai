/**
 * Proxy Integration Hooks — wire agentic features into the proxy pipeline.
 *
 * Import and call these functions from proxy-server.ts at `tools/call` time
 * to enable behavior observation and prompt injection detection.
 *
 * Usage in proxy-server.ts (add after policy evaluation, before forwarding):
 *
 *   import { hookAgenticObservation, hookPromptInjectionCheck } from '../agentic/proxy-integration.js';
 *   await hookAgenticObservation(container, serverName, toolName, args, sessionKey, latencyMs, success);
 *   await hookPromptInjectionCheck(container, serverName, toolName, args);
 */

import type { Container } from '../container.js';
import { Logger } from '../utils/logger.js';

/**
 * Hook: Record a tool call observation for policy generation.
 * Call this on every tools/call that passes through the proxy.
 */
export async function hookAgenticObservation(
  container: Container,
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
  sessionHash: string,
  _latencyMs: number,
  _success: boolean,
): Promise<void> {
  if (!container.behaviorCollector.isActive()) return;

  try {
    const argKeys = Object.keys(args);
    const argTypes: Record<string, string> = {};
    const argRanges: Record<string, { min?: number; max?: number; avg?: number }> = {};

    for (const key of argKeys) {
      const val = args[key];
      argTypes[key] = typeof val === 'string' ? 'string'
        : typeof val === 'number' ? 'number'
        : typeof val === 'boolean' ? 'boolean'
        : Array.isArray(val) ? 'array'
        : typeof val === 'object' && val !== null ? 'object'
        : 'unknown';

      if (typeof val === 'string') {
        argRanges[key] = { min: val.length, max: val.length, avg: val.length };
      } else if (typeof val === 'number') {
        argRanges[key] = { min: val, max: val, avg: val };
      }
    }

    container.behaviorCollector.record({
      toolName,
      serverName,
      argumentKeys: argKeys,
      argumentTypes: argTypes,
      argumentRanges: argRanges,
      timestamp: Date.now(),
      latencyMs: _latencyMs,
      success: _success,
      sessionHash,
    });
  } catch (err: unknown) {
    Logger.debug(`[AgenticProxyIntegration] Observation hook error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Hook: Run prompt injection detection on tool call arguments.
 * Call this before forwarding the tool call to the downstream server.
 *
 * Returns sanitized arguments if injection was detected and sanitization was applied.
 */
export async function hookPromptInjectionCheck(
  container: Container,
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<{ blocked: boolean; sanitizedArgs?: Record<string, unknown>; reason?: string }> {
  try {
    const result = await container.promptInjectionDetector.scan(toolName, serverName, args);
    const data = result.data!;

    if (data.detected) {
      // Record the decision in telemetry
      container.telemetry.recordDecision(
        'proxy-pipeline',
        'prompt-injection',
        {
          decisionId: crypto.randomUUID(),
          source: 'prompt-injection-detector',
          rationale: data.explanation,
          confidence: data.confidence,
          requiresApproval: data.confidence > 0.5 && data.confidence < 0.9,
          suggestedAction: data.confidence > 0.7 ? 'BLOCK' : 'WARN',
          timestamp: new Date().toISOString(),
          metadata: { toolName, serverName, category: data.category },
        },
        data.confidence > 0.7 ? 'auto_applied' : 'pending',
      );

      // If high confidence (>0.7), block and sanitize
      if (data.confidence > 0.7) {
        const sanitized = container.argumentSanitizer.sanitize(args, data);
        return {
          blocked: true,
          sanitizedArgs: sanitized.args,
          reason: `PROMPT_INJECTION: ${data.explanation} (confidence: ${(data.confidence * 100).toFixed(0)}%)`,
        };
      }

      // Medium confidence (0.5-0.7): warn but allow through with sanitization
      if (data.confidence > 0.5) {
        const sanitized = container.argumentSanitizer.sanitize(args, data);
        Logger.warn(`[AgenticProxyIntegration] Prompt injection WARNING: ${data.explanation}`);
        return {
          blocked: false,
          sanitizedArgs: sanitized.args,
          reason: `WARNING: ${data.explanation}`,
        };
      }
    }

    return { blocked: false };
  } catch (err: unknown) {
    Logger.debug(`[AgenticProxyIntegration] Prompt injection hook error: ${err instanceof Error ? err.message : String(err)}`);
    return { blocked: false };
  }
}

/**
 * Hook: Submit blocked attack patterns to the threat intelligence mesh.
 * Call this when a policy rule blocks a tool call.
 */
export function hookThreatMeshContribution(
  container: Container,
  blockedPattern: string,
  category: string,
  severity: 'critical' | 'high' | 'medium' | 'low' = 'high',
): void {
  try {
    container.threatMeshNode.submitObservation(blockedPattern, category, severity);
  } catch (err: unknown) {
    Logger.debug(`[AgenticProxyIntegration] Threat mesh hook error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export interface AgenticAuditParams {
  sessionId: string;
  method: string;
  toolName?: string;
  args?: Record<string, unknown>;
  latencyMs: number;
  blocked: boolean;
  blockReason?: string;
  responseSize?: number;
  statusCode?: string;
  userId?: string;
}

/** Record an MCP request in the agentic audit trail. */
export function recordAgenticAudit(container: Container, params: AgenticAuditParams): void {
  try {
    container.requestAuditor.record({
      sessionId: params.sessionId,
      method: params.method,
      toolName: params.toolName,
      args: params.args,
      latencyMs: params.latencyMs,
      blocked: params.blocked,
      blockReason: params.blockReason,
      responseSize: params.responseSize ?? 0,
      statusCode: params.statusCode ?? (params.blocked ? 'blocked' : 'ok'),
      userId: params.userId,
    });
  } catch (err: unknown) {
    Logger.debug(
      `[AgenticProxyIntegration] Audit record error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Pre-forward hooks: prompt injection scan + behavior observation start. */
export async function runAgenticPreForwardHooks(
  container: Container,
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
  sessionHash: string,
): Promise<{ blocked: boolean; sanitizedArgs?: Record<string, unknown>; reason?: string }> {
  const injection = await hookPromptInjectionCheck(container, serverName, toolName, args);
  if (injection.blocked) {
    return injection;
  }
  await hookAgenticObservation(container, serverName, toolName, args, sessionHash, 0, true);
  return injection;
}

/** Post-response hooks: finalize observation metrics. */
export async function runAgenticPostCallHooks(
  container: Container,
  serverName: string,
  toolName: string,
  args: Record<string, unknown>,
  sessionHash: string,
  latencyMs: number,
  success: boolean,
): Promise<void> {
  await hookAgenticObservation(container, serverName, toolName, args, sessionHash, latencyMs, success);
}

/** Denied call: audit + optional threat mesh contribution. */
export function runAgenticDeniedCallHooks(
  container: Container,
  params: AgenticAuditParams & { blockRule?: string },
): void {
  recordAgenticAudit(container, params);
  if (params.blockRule && params.toolName) {
    hookThreatMeshContribution(
      container,
      `${params.toolName}:${params.blockRule}`,
      params.blockRule,
      'high',
    );
  }
}