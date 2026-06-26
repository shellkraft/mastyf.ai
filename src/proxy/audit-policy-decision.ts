import { ingestPolicyDecision } from '../ai/block-learning.js';
import type { CallContext, PolicyDecision } from '../policy/policy-types.js';
import { StructuredLogger } from '../utils/structured-logger.js';

/** Emit policy_decision audit + SIEM events for all proxy transports. */
export function auditPolicyDecision(
  requestId: string | number,
  serverName: string,
  toolName: string,
  decision: PolicyDecision,
  context: CallContext,
): void {
  ingestPolicyDecision({
    requestId,
    serverName,
    toolName,
    action: decision.action,
    rule: decision.rule,
    reason: decision.reason,
    timestamp: context.timestamp,
    requestTokens: context.requestTokens,
  });

  StructuredLogger.logPolicyDecision({
    event: 'policy_decision',
    requestId,
    serverName,
    toolName,
    decision,
    context,
  });
}
