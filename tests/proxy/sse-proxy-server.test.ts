import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'http';
import { SseProxyServer } from '../../src/proxy/sse-proxy-server.js';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import { HistoryDatabase } from '../../src/database/history-db.js';
import { startMcpSseEchoFixture } from '../fixtures/start-mcp-echo-fixture.js';

describe('SseProxyServer', () => {
  const prevDlp = process.env.MASTYF_AI_RESPONSE_DLP_MODE;
  let upstream: Awaited<ReturnType<typeof startMcpSseEchoFixture>> | null = null;
  let db: HistoryDatabase;

  beforeEach(async () => {
    process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM = 'true';
    db = new HistoryDatabase(':memory:');
    await db.initialize();
  });

  afterEach(async () => {
    delete process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM;
    if (prevDlp) process.env.MASTYF_AI_RESPONSE_DLP_MODE = prevDlp;
    else delete process.env.MASTYF_AI_RESPONSE_DLP_MODE;
    await upstream?.close();
    upstream = null;
    db.close();
  });

  it('uses real PolicyEngine to block tools/call', async () => {
    const policy = new PolicyEngine({
      version: '1.0',
      policy: {
        mode: 'block',
        default_action: 'allow',
        rules: [{ name: 'deny-eval', action: 'block', tools: { deny: ['eval'] } }],
      },
    });

    const proxy = new SseProxyServer({
      upstreamUrl: 'http://127.0.0.1:9/never-called',
      serverName: 'sse-test',
      policy,
      db,
    });

    const result = await proxy.interceptAndForward({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'eval', arguments: { cmd: 'id' } },
    });

    expect(result).toMatchObject({ error: { code: -32001 } });
  });

  it('forwards tools/call through SSE echo upstream when policy allows', async () => {
    upstream = await startMcpSseEchoFixture();
    const policy = new PolicyEngine({
      version: '1.0',
      policy: { mode: 'block', default_action: 'allow', rules: [] },
    });
    const proxy = new SseProxyServer({
      upstreamUrl: upstream.baseUrl,
      serverName: 'sse-integration',
      policy,
      db,
    });

    const discovered = await (proxy as any).discoverUpstreamSession(new URL(upstream.baseUrl + '/sse'));
    expect(discovered?.sessionId).toBeTruthy();

    const session = {
      id: 'local-sess',
      upstreamSessionId: discovered!.sessionId,
      upstreamMessageUrl: discovered!.messageUrl,
      createdAt: Date.now(),
    };

    const result = await proxy.interceptAndForward(
      {
        jsonrpc: '2.0',
        id: 'tc-1',
        method: 'tools/call',
        params: { name: 'echo', arguments: { text: 'hi' } },
      },
      {},
      session,
    );
    const text = (result.result as { content?: { text?: string }[] })?.content?.[0]?.text ?? '';
    expect(text).toContain('hi');
  });

  it('redacts PII echoed from upstream when DLP redact mode is on', async () => {
    process.env.MASTYF_AI_RESPONSE_DLP_MODE = 'redact';
    upstream = await startMcpSseEchoFixture();
    const policy = new PolicyEngine({
      version: '1.0',
      policy: { mode: 'block', default_action: 'allow', rules: [] },
    });
    const proxy = new SseProxyServer({
      upstreamUrl: upstream.baseUrl,
      serverName: 'sse-redact',
      policy,
      db,
    });

    const discovered = await (proxy as any).discoverUpstreamSession(new URL(upstream.baseUrl + '/sse'));
    const session = {
      id: 'local-sess',
      upstreamSessionId: discovered!.sessionId,
      upstreamMessageUrl: discovered!.messageUrl,
      createdAt: Date.now(),
    };

    const result = await proxy.interceptAndForward(
      {
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: { name: 'echo', arguments: { note: 'patient ssn 123-45-6789' } },
      },
      {},
      session,
    );
    expect(JSON.stringify(result)).not.toContain('123-45-6789');
  });

  it('GET /sse emits endpoint event with sessionId', async () => {
    upstream = await startMcpSseEchoFixture();
    const proxy = new SseProxyServer({
      upstreamUrl: upstream.baseUrl,
      serverName: 'sse-get',
      db,
    });
    const port = await proxy.start(0);
    const sseText = await new Promise<string>((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}/sse`, (res) => {
        let buf = '';
        res.on('data', (c) => { buf += c.toString(); });
        res.on('end', () => resolve(buf));
        res.on('error', reject);
      }).on('error', reject);
    });
    expect(sseText).toContain('event: endpoint');
    expect(sseText).toMatch(/sessionId=[a-f0-9-]+/i);
    await proxy.stop();
  });
});
