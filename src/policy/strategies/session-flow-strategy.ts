import {
  evaluateSessionFlowGuard,
  evaluateLoopAnomalyGuard,
  recordSessionToolCall,
} from '../session-flow-guard.js';
import {
  evaluateSessionChainGuard,
} from '../session-chain-detector.js';
import type { PolicyStrategy } from './types.js';

/** Multi-call read-then-exfil sequencing and cross-tool chain detection. */
export const sessionFlowStrategy: PolicyStrategy = {
  name: 'session-flow',
  evaluate({ normalized }, deps) {
    const loop = evaluateLoopAnomalyGuard(normalized);
    if (loop) {
      recordSessionToolCall(normalized);
      return { ...loop, action: deps.resolveAction(loop.action) };
    }
    const chainDetect = evaluateSessionChainGuard(normalized);
    if (chainDetect) {
      recordSessionToolCall(normalized);
      return { ...chainDetect, action: deps.resolveAction(chainDetect.action) };
    }
    const chain = evaluateSessionFlowGuard(normalized);
    if (chain) {
      recordSessionToolCall(normalized);
      return { ...chain, action: deps.resolveAction(chain.action) };
    }
    recordSessionToolCall(normalized);
    return null;
  },
};
