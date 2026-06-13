import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { StreamableHttpProxyServer } from '../../src/proxy/streamable-http-proxy-server.js';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import { startMcpHttpEchoFixture } from '../fixtures/start-mcp-echo-fixture.js';

let upstream: Awaited<ReturnType<typeof startMcpHttpEchoFixture>>;
let upstreamPort = 0;

function toolsCall(id: number, tool: string, args: Record<string, unknown> = {}) {
  return {
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: { name: tool, arguments: args },
  };
}

async function postMcp(port: number, body: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

describe('integration: streamable HTTP upstream relay', () => {
  const prevRelay = process.env.MASTYFF_AI_STREAMABLE_HTTP_UPSTREAM_RELAY;
  const prevDlp = process.env.MASTYFF_AI_RESPONSE_DLP_MODE;

  beforeAll(async () => {
    upstream = await startMcpHttpEchoFixture();
    upstreamPort = upstream.port;
  });

  afterAll(async () => {
    await upstream.close();
  });

  beforeEach(() => {
    process.env.MASTYFF_AI_STREAMABLE_HTTP_UPSTREAM_RELAY = 'true';
  });

  afterEach(() => {
    if (prevRelay === undefined) delete process.env.MASTYFF_AI_STREAMABLE_HTTP_UPSTREAM_RELAY;
    else process.env.MASTYFF_AI_STREAMABLE_HTTP_UPSTREAM_RELAY = prevRelay;
    if (prevDlp === undefined) delete process.env.MASTYFF_AI_RESPONSE_DLP_MODE;
    else process.env.MASTYFF_AI_RESPONSE_DLP_MODE = prevDlp;
  });

  it('relays tools/call to upstream echo and returns echoed arguments', async () => {
    const policy = new PolicyEngine({
      version: '1.0',
      policy: { mode: 'block', default_action: 'allow', rules: [] },
    });
    const proxy = new StreamableHttpProxyServer({
      listenPort: 0,
      upstreamBaseUrl: `http://127.0.0.1:${upstreamPort}`,
      serverName: 'stream-int',
      policy,
    });
    await proxy.start();
    const port = proxy.getListenPort();

    const { status, json } = await postMcp(
      port,
      toolsCall(10, 'echo', { message: 'hello upstream' }),
    );
    await proxy.stop();

    expect(status).toBe(200);
    const body = json as { result?: { content?: { text?: string }[] } };
    const text = body.result?.content?.[0]?.text ?? '';
    expect(text).toContain('hello upstream');
  });

  it('redacts PII echoed from upstream when DLP redact mode is on', async () => {
    process.env.MASTYFF_AI_RESPONSE_DLP_MODE = 'redact';
    const policy = new PolicyEngine({
      version: '1.0',
      policy: { mode: 'block', default_action: 'allow', rules: [] },
    });
    const proxy = new StreamableHttpProxyServer({
      listenPort: 0,
      upstreamBaseUrl: `http://127.0.0.1:${upstreamPort}`,
      serverName: 'stream-redact',
      policy,
    });
    await proxy.start();
    const port = proxy.getListenPort();

    const { status, json } = await postMcp(
      port,
      toolsCall(11, 'echo', { note: 'patient ssn 123-45-6789' }),
    );
    await proxy.stop();

    expect(status).toBe(200);
    const text = JSON.stringify(json);
    expect(text).not.toContain('123-45-6789');
  });

  it('blocks upstream echo response with sensitive content in block DLP mode', async () => {
    process.env.MASTYFF_AI_RESPONSE_DLP_MODE = 'block';
    const policy = new PolicyEngine({
      version: '1.0',
      policy: { mode: 'block', default_action: 'allow', rules: [] },
    });
    const proxy = new StreamableHttpProxyServer({
      listenPort: 0,
      upstreamBaseUrl: `http://127.0.0.1:${upstreamPort}`,
      serverName: 'stream-block',
      policy,
    });
    await proxy.start();
    const port = proxy.getListenPort();

    const { status, json } = await postMcp(
      port,
      toolsCall(12, 'echo', { note: 'patient ssn 123-45-6789' }),
    );
    await proxy.stop();

    expect(status).toBe(200);
    const err = (json as { error?: { code?: number; message?: string } }).error;
    expect(err?.code).toBe(-32002);
    expect(String(err?.message)).toMatch(/blocked/i);
  });
});
