import { describe, it, expect, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import http from 'http';
import { validatePemMaterial, loadInboundTlsFromEnv, relayToUpstream } from '../src/http-proxy-utils.js';

describe('http-proxy PDF2 remediation', () => {
  let dir = '';
  let certPath = '';
  let keyPath = '';

  afterEach(() => {
    delete process.env.MASTYF_AI_TLS_CERT_PATH;
    delete process.env.MASTYF_AI_TLS_KEY_PATH;
    if (certPath) {
      try { unlinkSync(certPath); } catch { /* ignore */ }
    }
    if (keyPath) {
      try { unlinkSync(keyPath); } catch { /* ignore */ }
    }
    certPath = '';
    keyPath = '';
  });

  it('M-011 rejects invalid PEM material', () => {
    expect(() => validatePemMaterial(Buffer.from('not a cert'), 'CERTIFICATE')).toThrow(/Invalid PEM/);
  });

  it('M-011 loads valid PEM from env paths', () => {
    dir = mkdtempSync(join(tmpdir(), 'mastyf-tls-'));
    certPath = join(dir, 'cert.pem');
    keyPath = join(dir, 'key.pem');
    execSync(
      `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 1 -nodes -subj /CN=localhost`,
      { stdio: 'pipe' },
    );
    process.env.MASTYF_AI_TLS_CERT_PATH = certPath;
    process.env.MASTYF_AI_TLS_KEY_PATH = keyPath;
    const tls = loadInboundTlsFromEnv();
    expect(tls?.cert.length).toBeGreaterThan(0);
    expect(tls?.key.length).toBeGreaterThan(0);
  });

  it('M-013 returns JSON-RPC error when upstream relay fails', async () => {
    process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM = 'true';
    const body = await new Promise<string>((resolve) => {
      const clientRes = {
        headersSent: false,
        writeHead(_status: number, _headers: Record<string, string>) {},
        end(payload: string) {
          resolve(payload);
        },
      } as http.ServerResponse;

      relayToUpstream({
        upstream: new URL('http://127.0.0.1:1/unreachable'),
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
        clientRes,
        timeoutMs: 500,
        jsonRpcId: 42,
      });
    });
    const parsed = JSON.parse(body) as { jsonrpc: string; id: number; error: { code: number } };
    expect(parsed.jsonrpc).toBe('2.0');
    expect(parsed.id).toBe(42);
    expect(parsed.error.code).toBe(-32002);
    delete process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM;
  });
});
