import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { HttpProxyServer } from '../../src/proxy/http-proxy-server.js';
import { PolicyEngine } from '../../src/policy/policy-engine.js';
import type { PolicyConfig } from '../../src/policy/policy-types.js';

const minimalPolicy: PolicyConfig = {
  version: '1.0',
  policy: { mode: 'audit', rules: [] },
};

describe('HttpProxyServer', () => {
  let proxy: HttpProxyServer | null = null;
  let tempDir: string | null = null;

  beforeEach(() => {
    process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM = 'true';
  });

  afterEach(async () => {
    if (proxy) {
      await proxy.stop();
      proxy = null;
    }
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
    delete process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM;
    delete process.env.MASTYF_AI_REQUIRE_INBOUND_TLS;
    delete process.env.MASTYF_AI_AUTH_REQUIRED;
    delete process.env.MASTYF_AI_TLS_CERT_PATH;
    delete process.env.MASTYF_AI_TLS_KEY_PATH;
    vi.unstubAllEnvs();
  });

  it('starts and stops on ephemeral port', async () => {
    proxy = new HttpProxyServer(
      'http://127.0.0.1:9',
      'test-upstream',
      new PolicyEngine(minimalPolicy),
      undefined,
      undefined,
      0,
    );
    await proxy.start();
    const port = proxy.getPort();
    expect(port).toBeGreaterThan(0);
    await proxy.stop();
    proxy = null;
  });

  it('exposes server name and target', () => {
    proxy = new HttpProxyServer('https://api.example.com/mcp', 'remote', undefined, undefined, undefined, 0);
    expect(proxy.getServerName()).toBe('remote');
    expect(proxy.getTargetUrl()).toContain('api.example.com');
  });

  it('rejects construction when inbound TLS required but unset', () => {
    process.env.MASTYF_AI_REQUIRE_INBOUND_TLS = 'true';
    expect(
      () => new HttpProxyServer('http://127.0.0.1:9', 'tls-test', undefined, undefined, undefined, 0),
    ).toThrow(/MASTYF_AI_REQUIRE_INBOUND_TLS/);
  });

  it('rejects construction when auth required but validator missing', () => {
    process.env.MASTYF_AI_AUTH_REQUIRED = 'true';
    expect(
      () => new HttpProxyServer('http://127.0.0.1:9', 'auth-test', undefined, undefined, undefined, 0),
    ).toThrow(/MASTYF_AI_AUTH_REQUIRED/);
  });

  it('starts with inbound TLS when cert paths are configured', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'http-proxy-tls-'));
    const certPath = join(tempDir, 'cert.pem');
    const keyPath = join(tempDir, 'key.pem');
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 1 -nodes -subj /CN=localhost`,
      { stdio: 'ignore' },
    );
    process.env.MASTYF_AI_TLS_CERT_PATH = certPath;
    process.env.MASTYF_AI_TLS_KEY_PATH = keyPath;
    proxy = new HttpProxyServer(
      'http://127.0.0.1:9',
      'tls-listen',
      new PolicyEngine(minimalPolicy),
      undefined,
      undefined,
      0,
    );
    await proxy.start();
    expect(proxy.getPort()).toBeGreaterThan(0);
  });
});
