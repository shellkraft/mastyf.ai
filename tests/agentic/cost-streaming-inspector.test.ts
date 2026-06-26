import { describe, expect, it } from 'vitest';
import { createStreamingInspectorState } from '../../src/utils/streaming-inspector.js';
import { inspectCostStreamingChunk } from '../../src/agentic/response-dlp/cost-streaming-inspector.js';

describe('cost-streaming-inspector', () => {
  it('terminates stream when token cap exceeded', () => {
    process.env.MASTYF_AI_STREAMING_TOKEN_CAP = '10';
    const state = createStreamingInspectorState();
    const result = inspectCostStreamingChunk(state, Buffer.alloc(100), 'tenant');
    expect(result.terminateStream).toBe(true);
    delete process.env.MASTYF_AI_STREAMING_TOKEN_CAP;
  });
});
