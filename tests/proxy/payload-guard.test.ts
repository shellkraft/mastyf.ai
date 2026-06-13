import { describe, it, expect } from 'vitest';
import { hasJsonRpcId, jsonRpcErrorBody } from '../../src/proxy/json-rpc-utils.js';
import { checkExpandedPayload, checkRawPayloadSize } from '../../src/proxy/payload-guard.js';

describe('json-rpc utils', () => {
  it('treats id 0 as valid', () => {
    expect(hasJsonRpcId(0)).toBe(true);
    expect(jsonRpcErrorBody(0, -32001, 'blocked').id).toBe(0);
  });

  it('omits id for notifications', () => {
    expect(hasJsonRpcId(null)).toBe(false);
    expect(jsonRpcErrorBody(null, -32001, 'blocked').id).toBeUndefined();
  });

  it('preserves string ids on errors', () => {
    const body = jsonRpcErrorBody('req-abc', -32001, 'blocked');
    expect(body.id).toBe('req-abc');
  });

  it('undefined id omits response id field', () => {
    expect(hasJsonRpcId(undefined)).toBe(false);
    expect(jsonRpcErrorBody(undefined, -32001, 'blocked').id).toBeUndefined();
  });
});

describe('payload guard', () => {
  it('rejects oversized raw payload', () => {
    const prev = process.env.MASTYFF_AI_MAX_PAYLOAD_BYTES;
    process.env.MASTYFF_AI_MAX_PAYLOAD_BYTES = '100';
    const big = 'x'.repeat(200);
    expect(checkRawPayloadSize(big).ok).toBe(false);
    if (prev === undefined) delete process.env.MASTYFF_AI_MAX_PAYLOAD_BYTES;
    else process.env.MASTYFF_AI_MAX_PAYLOAD_BYTES = prev;
  });

  it('rejects expanded args over limit', () => {
    const prev = process.env.MASTYFF_AI_MAX_EXPANDED_PAYLOAD_BYTES;
    process.env.MASTYFF_AI_MAX_EXPANDED_PAYLOAD_BYTES = '50';
    expect(checkExpandedPayload({ data: 'x'.repeat(100) }).ok).toBe(false);
    if (prev === undefined) delete process.env.MASTYFF_AI_MAX_EXPANDED_PAYLOAD_BYTES;
    else process.env.MASTYFF_AI_MAX_EXPANDED_PAYLOAD_BYTES = prev;
  });
});
