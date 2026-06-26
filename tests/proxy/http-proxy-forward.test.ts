import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import http from 'http';
import { createHttpProxy } from '../../packages/server/src/http-proxy.js';

describe('createHttpProxy (packages/server)', () => {
  let upstream: http.Server | null = null;
  let proxy: http.Server | null = null;
  let upstreamMethod = '';
  let proxyPort = 0;

  beforeEach(() => {
    process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM = 'true';
  });

  afterEach(async () => {
    delete process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM;
    await new Promise<void>((r) => proxy?.close(() => r()));
    await new Promise<void>((r) => upstream?.close(() => r()));
    proxy = null;
    upstream = null;
  });

  it('preserves GET method for non-POST traffic', async () => {
    upstream = http.createServer((req, res) => {
      upstreamMethod = req.method || '';
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('upstream-ok');
    });
    await new Promise<void>((r) => upstream!.listen(0, '127.0.0.1', () => r()));
    const upstreamPort = (upstream!.address() as { port: number }).port;

    proxy = createHttpProxy(
      `http://127.0.0.1:${upstreamPort}`,
      null,
      { addCallRecord: async () => {} },
      { count: () => 0 },
    );
    await new Promise<void>((r) => proxy!.listen(0, '127.0.0.1', () => r()));
    proxyPort = (proxy!.address() as { port: number }).port;

    const res = await fetch(`http://127.0.0.1:${proxyPort}/health`, { method: 'GET' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('upstream-ok');
    expect(upstreamMethod).toBe('GET');
  });

  it('preserves GET for non-JSON POST body', async () => {
    upstream = http.createServer((req, res) => {
      upstreamMethod = req.method || '';
      let data = '';
      req.on('data', (c) => { data += c; });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`${req.method}:${data}`);
      });
    });
    await new Promise<void>((r) => upstream!.listen(0, '127.0.0.1', () => r()));
    const upstreamPort = (upstream!.address() as { port: number }).port;

    proxy = createHttpProxy(
      `http://127.0.0.1:${upstreamPort}`,
      null,
      { addCallRecord: async () => {} },
      { count: () => 0 },
    );
    await new Promise<void>((r) => proxy!.listen(0, '127.0.0.1', () => r()));
    proxyPort = (proxy!.address() as { port: number }).port;

    const res = await fetch(`http://127.0.0.1:${proxyPort}/raw`, {
      method: 'PUT',
      body: 'plain-text',
    });
    expect(await res.text()).toBe('PUT:plain-text');
    expect(upstreamMethod).toBe('PUT');
  });
});
