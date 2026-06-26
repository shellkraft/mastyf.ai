import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StreamableHttpProxyServer } from '../../src/proxy/streamable-http-proxy-server.js';
import { PolicyEngine } from '../../src/policy/policy-engine.js';

describe('StreamableHttpProxyServer', () => {
  beforeEach(() => {
    process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM = 'true';
  });

  afterEach(() => {
    delete process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM;
  });

  it('blocks tools/call on POST /mcp when policy denies', async () => {
    const policy = new PolicyEngine({
      version: '1.0',
      policy: {
        mode: 'block',
        default_action: 'allow',
        rules: [{ name: 'deny-eval', action: 'block', tools: { deny: ['eval'] } }],
      },
    });
    const proxy = new StreamableHttpProxyServer({
      listenPort: 0,
      upstreamBaseUrl: 'http://127.0.0.1:9',
      serverName: 'stream-test',
      policy,
    });

    const blocked = await (proxy as any).maybeBlockMessage(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'eval' },
      },
      { headers: {} },
    );

    expect(blocked?.error?.code).toBe(-32001);
    expect(String(blocked?.error?.message)).toMatch(/blocked|policy/i);
  });
});
