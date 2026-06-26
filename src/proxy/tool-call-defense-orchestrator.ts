/**
 * ToolCallDefenseOrchestrator — unified Defense Fabric pipeline for all transports.
 *
 * Phases: lifecycle → pre-guard → policy → post-policy (spend + semantic).
 */
import type { IncomingHttpHeaders } from 'http';
import type { PolicyEngine } from '../policy/policy-engine.js';
import type { CallContext, PolicyDecision } from '../policy/policy-types.js';
import type { IDatabase } from '../database/database-interface.js';
import type { AgentIdentity } from '../auth/auth-types.js';
import { applyGeoToCallContext } from '../utils/request-geo-context.js';
import { auditPolicyDecision } from './audit-policy-decision.js';
import { notifyToolBlock } from '../alerting/notify-tool-block.js';
import { StructuredLogger } from '../utils/structured-logger.js';
import * as Metrics from '../utils/metrics.js';
import {
  runToolCallPreForwardGuard,
  type ToolCallPreGuardResult,
} from './tool-call-pre-guard.js';
import {
  isPostPolicyGateBlock,
  runPostPolicyAllowGates,
  type PostPolicyAllowGateOutcome,
} from './proxy-post-allow-gates.js';
import { runLifecycleAssuranceGates } from './lifecycle-assurance-gates.js';
import type { ToolFingerprintState } from './tool-fingerprint.js';

export interface ToolCallDefenseInput {
  serverName: string;
  toolName: string;
  arguments?: Record<string, unknown>;
  requestId: string;
  requestTokens: number;
  tenantId: string;
  timestamp?: string;
  agentIdentity?: AgentIdentity;
  headers?: IncomingHttpHeaders | Record<string, string | string[] | undefined>;
  meta?: Record<string, unknown>;
  mcpSessionId?: string;
  agentId?: string;
  idempotencyKey?: string;
}

export type ToolCallDefenseBlocked = {
  allowed: false;
  phase: 'lifecycle' | 'pre-guard' | 'policy' | 'semantic' | 'spend';
  code: number;
  rule: string;
  reason: string;
  httpStatus?: number;
  preGuard?: Extract<ToolCallPreGuardResult, { blocked: true }>;
};

export type ToolCallDefenseAllowed = {
  allowed: true;
  arguments: Record<string, unknown> | undefined;
  context: CallContext;
  decision: PolicyDecision;
  spendReservationId?: string;
  gateOutcome: PostPolicyAllowGateOutcome | null;
};

export type ToolCallDefenseResult = ToolCallDefenseBlocked | ToolCallDefenseAllowed;

export interface ToolCallDefenseDeps {
  policyEngine: PolicyEngine;
  db?: IDatabase;
  rugPullState?: ToolFingerprintState;
  /** When set, replaces policyEngine.evaluateAsync (e.g. pinned policy eval on stdio). */
  evaluatePolicy?: (context: CallContext) => Promise<PolicyDecision>;
  /** When false, skip notifyToolBlock / metrics (caller handles). Default true. */
  emitBlockTelemetry?: boolean;
}

function policyHttpStatus(decision: PolicyDecision): number {
  const rateLimited =
    /rate\s*limit/i.test(decision.reason || '') ||
    /rate/i.test(decision.rule || '');
  return rateLimited ? 429 : 403;
}

export async function evaluateToolCallDefense(
  input: ToolCallDefenseInput,
  deps: ToolCallDefenseDeps,
): Promise<ToolCallDefenseResult> {
  const emitTelemetry = deps.emitBlockTelemetry !== false;
  const timestamp = input.timestamp ?? new Date().toISOString();

  const lifecycle = await runLifecycleAssuranceGates({
    serverName: input.serverName,
    toolName: input.toolName,
    tenantId: input.tenantId,
    rugPullState: deps.rugPullState,
    db: deps.db,
  });
  if (lifecycle.block) {
    if (emitTelemetry) {
      StructuredLogger.logBlocked({
        event: 'tool_blocked',
        requestId: input.requestId,
        serverName: input.serverName,
        toolName: input.toolName,
        reason: lifecycle.reason ?? 'lifecycle gate',
        rule: lifecycle.rule ?? lifecycle.phase ?? 'lifecycle',
      });
      Metrics.recordProxyBlock(
        {
          server_name: input.serverName,
          block_reason: lifecycle.phase ?? 'lifecycle',
          rule: lifecycle.rule ?? 'lifecycle',
          tenant_id: input.tenantId,
        },
      );
    }
    return {
      allowed: false,
      phase: 'lifecycle',
      code: lifecycle.code ?? -32001,
      rule: lifecycle.rule ?? 'lifecycle-gate',
      reason: lifecycle.reason ?? 'Blocked by lifecycle assurance',
      httpStatus: 403,
    };
  }

  const preGuard = await runToolCallPreForwardGuard(
    input.serverName,
    input.toolName,
    input.arguments,
    input.requestId,
    {
      agentId: input.agentId,
      mcpSessionId: input.mcpSessionId,
      meta: input.meta,
      headers: input.headers,
    },
  );
  if (preGuard.blocked) {
    if (emitTelemetry) {
      StructuredLogger.logBlocked({
        event: 'tool_blocked',
        requestId: input.requestId,
        serverName: input.serverName,
        toolName: input.toolName,
        reason: preGuard.message,
        rule: 'payload_or_agentic',
      });
    }
    return {
      allowed: false,
      phase: 'pre-guard',
      code: preGuard.code,
      rule: 'payload_or_agentic',
      reason: preGuard.message,
      httpStatus: 403,
      preGuard,
    };
  }

  const requestArguments = preGuard.arguments ?? input.arguments;

  const context: CallContext = applyGeoToCallContext({
    serverName: input.serverName,
    toolName: input.toolName,
    arguments: requestArguments,
    requestId: input.requestId,
    requestTokens: input.requestTokens,
    timestamp,
    tenantId: input.tenantId,
    agentIdentity: input.agentIdentity,
    idempotencyKey: input.idempotencyKey,
  }, input.headers);

  const decision = deps.evaluatePolicy
    ? await deps.evaluatePolicy(context)
    : await deps.policyEngine.evaluateAsync(context);
  auditPolicyDecision(input.requestId, input.serverName, input.toolName, decision, context);

  const policyMode = deps.policyEngine.getMode();
  const shouldDeny =
    decision.action === 'block' ||
    (decision.action === 'flag' && policyMode === 'block');

  if (shouldDeny) {
    if (emitTelemetry) {
      notifyToolBlock({
        serverName: input.serverName,
        toolName: input.toolName,
        rule: decision.rule,
        reason: decision.reason,
        requestId: input.requestId,
        anomalyScore: 0.95,
      });
      StructuredLogger.logBlocked({
        event: 'tool_blocked',
        requestId: input.requestId,
        serverName: input.serverName,
        toolName: input.toolName,
        reason: decision.reason,
        rule: decision.rule,
      });
      Metrics.recordProxyBlock(
        {
          server_name: input.serverName,
          block_reason: `policy:${decision.rule}`,
          rule: decision.rule,
          tenant_id: input.tenantId,
        },
      );
      Metrics.requestsTotal.inc({
        server_name: input.serverName,
        decision: 'block',
        authn_success: 'true',
      });
    }
    return {
      allowed: false,
      phase: 'policy',
      code: -32001,
      rule: decision.rule,
      reason: decision.reason,
      httpStatus: policyHttpStatus(decision),
    };
  }

  const gateOutcome = await runPostPolicyAllowGates(context, decision, input.serverName);
  if (isPostPolicyGateBlock(gateOutcome)) {
    if (emitTelemetry) {
      StructuredLogger.logBlocked({
        event: 'tool_blocked',
        requestId: input.requestId,
        serverName: input.serverName,
        toolName: input.toolName,
        reason: gateOutcome.reason,
        rule: gateOutcome.rule ?? 'semantic_gate',
      });
    }
    return {
      allowed: false,
      phase: gateOutcome.rule === 'unified-spend-pool' || gateOutcome.rule?.includes('budget')
        ? 'spend'
        : 'semantic',
      code: -32001,
      rule: gateOutcome.rule ?? 'semantic_gate',
      reason: gateOutcome.reason,
      httpStatus: 403,
    };
  }

  const spendReservationId =
    gateOutcome && 'allowed' in gateOutcome ? gateOutcome.spendReservationId : undefined;

  return {
    allowed: true,
    arguments: requestArguments,
    context,
    decision,
    spendReservationId,
    gateOutcome,
  };
}
