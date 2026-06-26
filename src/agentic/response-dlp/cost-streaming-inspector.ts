/**
 * Mid-stream spend cutoff — terminates upstream streams when tenant token/min cap is exceeded.
 */
import type { StreamingInspectorState } from '../../utils/streaming-inspector.js';
import { getTokensPerMinCap } from './cost-streaming-config.js';

export interface CostStreamingInspectResult {
  terminateStream: boolean;
  reason?: string;
}

function estimateTokensFromBytes(bytes: number): number {
  return Math.max(1, Math.ceil(bytes / 4));
}

export function inspectCostStreamingChunk(
  state: StreamingInspectorState,
  chunk: string | Buffer,
  tenantId?: string,
): CostStreamingInspectResult {
  const bytes = typeof chunk === 'string' ? Buffer.byteLength(chunk, 'utf8') : chunk.length;
  state.totalBytes += bytes;
  const tokens = estimateTokensFromBytes(state.totalBytes);
  const cap = getTokensPerMinCap(tenantId);
  if (cap > 0 && tokens >= cap) {
    return {
      terminateStream: true,
      reason: `Streaming token budget exceeded (${tokens} >= ${cap})`,
    };
  }
  return { terminateStream: false };
}
