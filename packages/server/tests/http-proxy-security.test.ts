import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import http from 'http';
import { URL } from 'url';
import {
  resolveUpstreamPort,
  getMaxBodyBytes,
  assertUpstreamTlsAllowed,
} from '../src/http-proxy-utils.js';
import { createHttpProxy } from '../src/http-proxy.js';
import type { HttpProxyAuthValidator } from '../src/http-proxy-auth.js';

describe('http-proxy-utils', () => {
  it('resolveUpstreamPort uses 443 for https without explicit port', () => {
    expect(resolveUpstreamPort(new URL('https://example.com/path'))).toBe(443);
  });

  it('resolveUpstreamPort uses 80 for http without explicit port', () => {
    expect(resolveUpstreamPort(new URL('http://example.com/path'))).toBe(80);
  });

  it('resolveUpstreamPort respects explicit port', () => {
    expect(resolveUpstreamPort(new URL('https://example.com:8443/path'))).toBe(8443);
  });
});

describe('createHttpProxy security', () => {
  let upstream: http.Server | null = null;
  let proxy: http.Server | null = null;

  beforeEach(() => {
    process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM = 'true';
  });

  afterEach(async () => {
    if (proxy && 'closeAllConnections' in proxy) {
      (proxy as http.Server).closeAllConnections();
    }
    if (upstream && 'closeAllConnections' in upstream) {
      upstream.closeAllConnections();
    }
    await Promise.all([
      new Promise<void>((r) => (proxy ? proxy.close(() => r()) : r())),
      new Promise<void>((r) => (upstream ? upstream.close(() => r()) : r())),
    ]);
    proxy = null;
    upstream = null;
    delete process.env.MASTYF_AI_MAX_PAYLOAD_BYTES;
    delete process.env.MASTYF_AI_UPSTREAM_TIMEOUT_MS;
    delete process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM;
  });

  const noopDb = { addCallRecord: async () => {} };
  const noopTokens = { count: () => 0 };

  it('returns 413 when request body exceeds limit', async () => {
    upstream = http.createServer((_req, res) => {
      res.writeHead(200).end('ok');
    });
    await new Promise<void>((r) => upstream!.listen(0, '127.0.0.1', () => r()));
    const upstreamPort = (upstream!.address() as { port: number }).port;

    proxy = createHttpProxy(
      `http://127.0.0.1:${upstreamPort}`,
      null,
      noopDb,
      noopTokens,
      { maxBodyBytes: 32 },
    );
    await new Promise<void>((r) => proxy!.listen(0, '127.0.0.1', () => r()));
    const proxyPort = (proxy!.address() as { port: number }).port;

    const res = await fetch(`http://127.0.0.1:${proxyPort}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: { x: 'y'.repeat(100) } }),
    });
    expect(res.status).toBe(413);
  });

  it('returns 401 when auth is required and token missing', async () => {
    upstream = http.createServer((_req, res) => {
      res.writeHead(200).end('ok');
    });
    await new Promise<void>((r) => upstream!.listen(0, '127.0.0.1', () => r()));
    const upstreamPort = (upstream!.address() as { port: number }).port;

    const validator: HttpProxyAuthValidator = {
      getConfig: () => ({ required: true }),
      validate: async () => ({ valid: false, error: 'bad' }),
    };

    proxy = createHttpProxy(
      `http://127.0.0.1:${upstreamPort}`,
      null,
      noopDb,
      noopTokens,
      { authValidator: validator },
    );
    await new Promise<void>((r) => proxy!.listen(0, '127.0.0.1', () => r()));
    const proxyPort = (proxy!.address() as { port: number }).port;

    const res = await fetch(`http://127.0.0.1:${proxyPort}/mcp`, { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('returns 403 when auth is required and token invalid', async () => {
    upstream = http.createServer((_req, res) => {
      res.writeHead(200).end('ok');
    });
    await new Promise<void>((r) => upstream!.listen(0, '127.0.0.1', () => r()));
    const upstreamPort = (upstream!.address() as { port: number }).port;

    const validator: HttpProxyAuthValidator = {
      getConfig: () => ({ required: true }),
      validate: async (token) => ({ valid: token === 'good-token' }),
    };

    proxy = createHttpProxy(
      `http://127.0.0.1:${upstreamPort}`,
      null,
      noopDb,
      noopTokens,
      { authValidator: validator },
    );
    await new Promise<void>((r) => proxy!.listen(0, '127.0.0.1', () => r()));
    const proxyPort = (proxy!.address() as { port: number }).port;

    const res = await fetch(`http://127.0.0.1:${proxyPort}/mcp`, {
      method: 'GET',
      headers: { Authorization: 'Bearer bad-token' },
    });
    expect(res.status).toBe(403);
  });

  it('allows request when auth token is valid', async () => {
    upstream = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(req.method || '');
    });
    await new Promise<void>((r) => upstream!.listen(0, '127.0.0.1', () => r()));
    const upstreamPort = (upstream!.address() as { port: number }).port;

    const validator: HttpProxyAuthValidator = {
      getConfig: () => ({ required: true }),
      validate: async (token) => ({ valid: token === 'good-token' }),
    };

    proxy = createHttpProxy(
      `http://127.0.0.1:${upstreamPort}`,
      null,
      noopDb,
      noopTokens,
      { authValidator: validator },
    );
    await new Promise<void>((r) => proxy!.listen(0, '127.0.0.1', () => r()));
    const proxyPort = (proxy!.address() as { port: number }).port;

    const res = await fetch(`http://127.0.0.1:${proxyPort}/health`, {
      method: 'GET',
      headers: { Authorization: 'Bearer good-token' },
    });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('GET');
  });

  it('times out slow upstream requests', async () => {
    upstream = http.createServer((_req, res) => {
      setTimeout(() => {
        res.writeHead(200).end('late');
      }, 500);
    });
    await new Promise<void>((r) => upstream!.listen(0, '127.0.0.1', () => r()));
    const upstreamPort = (upstream!.address() as { port: number }).port;

    proxy = createHttpProxy(
      `http://127.0.0.1:${upstreamPort}`,
      null,
      noopDb,
      noopTokens,
      { upstreamTimeoutMs: 50 },
    );
    await new Promise<void>((r) => proxy!.listen(0, '127.0.0.1', () => r()));
    const proxyPort = (proxy!.address() as { port: number }).port;

    const res = await fetch(`http://127.0.0.1:${proxyPort}/slow`, { method: 'GET' });
    expect(res.status).toBe(504);
  });

  it('blocks http upstream by default', () => {
    delete process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM;
    expect(assertUpstreamTlsAllowed('http://127.0.0.1:8080').ok).toBe(false);
    expect(() =>
      createHttpProxy('http://127.0.0.1:8080', null, noopDb, noopTokens),
    ).toThrow(/Plaintext HTTP upstream is disabled/);
  });

  it('allows http upstream when dev flag is set', () => {
    process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM = 'true';
    expect(assertUpstreamTlsAllowed('http://127.0.0.1:8080').ok).toBe(true);
  });

  it('rejects createHttpProxy when inbound TLS required but unset', () => {
    process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM = 'true';
    process.env.MASTYF_AI_REQUIRE_INBOUND_TLS = 'true';
    expect(() =>
      createHttpProxy('http://127.0.0.1:8080', null, noopDb, noopTokens),
    ).toThrow(/MASTYF_AI_REQUIRE_INBOUND_TLS/);
    delete process.env.MASTYF_AI_REQUIRE_INBOUND_TLS;
  });

  it('rejects createHttpProxy when auth required but validator missing', () => {
    process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM = 'true';
    process.env.MASTYF_AI_AUTH_REQUIRED = 'true';
    expect(() =>
      createHttpProxy('http://127.0.0.1:8080', null, noopDb, noopTokens),
    ).toThrow(/MASTYF_AI_AUTH_REQUIRED/);
    delete process.env.MASTYF_AI_AUTH_REQUIRED;
  });
});

describe('readRequestBodyWithLimit', () => {
  it('uses default max from env', () => {
    expect(getMaxBodyBytes()).toBeGreaterThan(0);
  });
});
