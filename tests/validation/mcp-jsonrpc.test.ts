import { describe, expect, it } from 'vitest';
import { validateMcpJsonRpcMessage } from '../../src/validation/mcp-jsonrpc.js';

describe('validateMcpJsonRpcMessage', () => {
  it('rejects non-2.0 jsonrpc', () => {
    const result = validateMcpJsonRpcMessage({ jsonrpc: '1.0', method: 'ping', id: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(-32600);
  });

  it('rejects initialize with unsupported protocolVersion', () => {
    const result = validateMcpJsonRpcMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2099-01-01', capabilities: {} },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe(-32602);
  });

  it('accepts initialize with 2024-11-05', () => {
    const result = validateMcpJsonRpcMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {} },
    });
    expect(result.ok).toBe(true);
  });

  it('rejects tools/call without params.name', () => {
    const result = validateMcpJsonRpcMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { arguments: {} },
    });
    expect(result.ok).toBe(false);
  });
});
