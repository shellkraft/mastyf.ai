/**
 * Post-policy allow gates: unified spend reserve + semantic pipeline (all transports).
 */
import { tryReserveSpend } from '../services/unified-spend-pool.js';
import type { CallContext, PolicyDecision } from '../policy/policy-types.js';
import { flowSessionKey } from '../policy/session-flow-guard.js';
import {
  runSemanticPipelineAfterPolicyAllow,
} from './semantic-proxy-hooks.js';
import type { PostPolicyGateBlock } from './proxy-post-policy-gates.js';

export type { PostPolicyGateBlock };

function estimateUsd(context: CallContext): number {
  const tokens = context.requestTokens ?? 0;
  if (tokens <= 0) return 0.001;
  return tokens * 0.000002;
}

export async function runPostPolicyAllowGates(
  context: CallContext,
  decision: PolicyDecision,
  serverName: string,
): Promise<PostPolicyGateBlock | null> {
  const estimatedUsd = estimateUsd(context);
  const reserve = await tryReserveSpend({
    tenantId: context.tenantId,
    sessionKey: flowSessionKey(context),
    tokens: context.requestTokens ?? 0,
    estimatedUsd,
  });
  if (!reserve.ok) {
    return {
      block: true,
      rule: reserve.rule ?? 'unified-spend-pool',
      reason: reserve.reason ?? 'Spend cap exceeded',
      metricCategory: 'semantic_sync_request',
    };
  }

  return runSemanticPipelineAfterPolicyAllow(context, decision, serverName);
}
