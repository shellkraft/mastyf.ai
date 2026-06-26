import * as http from 'http';
import * as https from 'https';
import type { IncomingMessage, ServerResponse } from 'http';
import { readFileSync } from 'fs';
import { X509Certificate } from 'crypto';

const DEFAULT_MAX_BODY = 10 * 1024 * 1024;
const DEFAULT_UPSTREAM_TIMEOUT_MS = 30_000;

export function getMaxBodyBytes(): number {
  const raw =
    process.env['MASTYF_AI_MAX_PAYLOAD_BYTES'] ??
    process.env['MASTYF_AI_HTTP_MAX_BODY_BYTES'];
  if (raw !== undefined && raw !== '') {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_MAX_BODY;
}

export function getUpstreamTimeoutMs(): number {
  const raw = process.env['MASTYF_AI_UPSTREAM_TIMEOUT_MS'];
  if (raw == null || raw === '') return DEFAULT_UPSTREAM_TIMEOUT_MS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_UPSTREAM_TIMEOUT_MS;
}

export function resolveUpstreamPort(url: URL): number {
  if (url.port) return parseInt(url.port, 10);
  return url.protocol === 'https:' ? 443 : 80;
}

export function isPlaintextUpstreamAllowed(): boolean {
  if (process.env['MASTYF_AI_STRICT_MODE'] === 'true') {
    return false;
  }
  return process.env['MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM'] === 'true';
}

export type UpstreamTlsCheckResult =
  | { ok: true }
  | { ok: false; message: string };

/** Reject http:// upstream unless dev-only plaintext flag is set. */
export function assertUpstreamTlsAllowed(targetUrl: string): UpstreamTlsCheckResult {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { ok: false, message: 'Invalid upstream URL' };
  }
  if (parsed.protocol === 'http:' && !isPlaintextUpstreamAllowed()) {
    return {
      ok: false,
      message:
        'Plaintext HTTP upstream is disabled. Use https:// or set MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM=true (dev only).',
    };
  }
  return { ok: true };
}

export type ReadBodyResult =
  | { ok: true; body: string }
  | { ok: false; tooLarge: true; bytes: number; limit: number };

export async function readRequestBodyWithLimit(
  req: IncomingMessage,
  maxBytes = getMaxBodyBytes(),
): Promise<ReadBodyResult> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    total += buf.length;
    if (total > maxBytes) {
      return { ok: false, tooLarge: true, bytes: total, limit: maxBytes };
    }
    chunks.push(buf);
  }
  return { ok: true, body: Buffer.concat(chunks).toString('utf8') };
}

export function validatePemMaterial(buf: Buffer, label: 'CERTIFICATE' | 'PRIVATE KEY' | 'RSA PRIVATE KEY'): void {
  const text = buf.toString('utf8');
  const begin = `-----BEGIN ${label}-----`;
  const end = `-----END ${label}-----`;
  if (!text.includes(begin) || !text.includes(end)) {
    throw new Error(`Invalid PEM: expected ${label} block`);
  }
  if (label === 'CERTIFICATE') {
    try {
      // eslint-disable-next-line no-new
      new X509Certificate(buf);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid TLS certificate PEM: ${msg}`);
    }
  }
}

export function loadInboundTlsFromEnv():
  | { cert: Buffer; key: Buffer }
  | null {
  const certPath = process.env['MASTYF_AI_TLS_CERT_PATH'];
  const keyPath = process.env['MASTYF_AI_TLS_KEY_PATH'];
  if (!certPath || !keyPath) return null;
  const cert = readFileSync(certPath);
  const key = readFileSync(keyPath);
  validatePemMaterial(cert, 'CERTIFICATE');
  const keyText = key.toString('utf8');
  if (keyText.includes('BEGIN RSA PRIVATE KEY')) {
    validatePemMaterial(key, 'RSA PRIVATE KEY');
  } else {
    validatePemMaterial(key, 'PRIVATE KEY');
  }
  return { cert, key };
}

export interface RelayToUpstreamOptions {
  upstream: URL;
  method: string;
  headers: http.OutgoingHttpHeaders;
  clientRes: ServerResponse;
  timeoutMs: number;
  agent?: https.Agent;
  /** When set, write this body to upstream. Otherwise pipe `clientReq`. */
  body?: string;
  clientReq?: IncomingMessage;
  /** When set, buffer upstream response up to this many bytes. */
  maxResponseBytes?: number;
  /** JSON-RPC request id for structured upstream error responses (M-013). */
  jsonRpcId?: string | number | null;
  onBufferedResponse?: (
    responseBody: string,
    upstreamRes: IncomingMessage,
  ) => void | Promise<void>;
}

function requestUpstream(
  upstream: URL,
  opts: Omit<RelayToUpstreamOptions, 'upstream' | 'clientRes' | 'onBufferedResponse' | 'maxResponseBytes'>,
): http.ClientRequest {
  const isHttps = upstream.protocol === 'https:';
  const requestFn = isHttps ? https.request : http.request;
  const reqOpts: https.RequestOptions = {
    hostname: upstream.hostname,
    port: resolveUpstreamPort(upstream),
    path: upstream.pathname + upstream.search,
    method: opts.method,
    headers: opts.headers,
    timeout: opts.timeoutMs,
    agent: isHttps ? opts.agent : undefined,
  };
  return requestFn(reqOpts);
}

export function relayToUpstream(options: RelayToUpstreamOptions): void {
  const {
    upstream,
    method,
    headers,
    clientRes,
    timeoutMs,
    agent,
    body,
    clientReq,
    maxResponseBytes,
    onBufferedResponse,
    jsonRpcId,
  } = options;

  const tlsCheck = assertUpstreamTlsAllowed(upstream.toString());
  if (!tlsCheck.ok) {
    if (!clientRes.headersSent) {
      clientRes.writeHead(400, { 'Content-Type': 'application/json' });
      clientRes.end(JSON.stringify({ error: tlsCheck.message }));
    }
    return;
  }

  const upstreamReq = requestUpstream(upstream, {
    method,
    headers,
    timeoutMs,
    agent,
    body,
    clientReq,
  });

  const failClient = (status: number, message?: string) => {
    if (clientRes.headersSent) return;
    clientRes.writeHead(status, { 'Content-Type': 'application/json' });
    if (jsonRpcId !== undefined) {
      clientRes.end(JSON.stringify({
        jsonrpc: '2.0',
        id: jsonRpcId,
        error: {
          code: status === 504 ? -32001 : -32002,
          message: message || 'Upstream relay failed',
        },
      }));
      return;
    }
    if (message) {
      clientRes.end(JSON.stringify({ error: message }));
    } else {
      clientRes.end();
    }
  };

  upstreamReq.on('timeout', () => {
    upstreamReq.destroy();
    failClient(504, 'Upstream request timed out');
  });

  upstreamReq.on('error', () => {
    failClient(502);
  });

  upstreamReq.on('response', (upstreamRes) => {
    if (onBufferedResponse && maxResponseBytes != null) {
      const respChunks: Buffer[] = [];
      let respSize = 0;
      upstreamRes.on('data', (chunk: Buffer) => {
        respSize += chunk.length;
        if (respSize > maxResponseBytes) {
          upstreamRes.destroy();
          failClient(413, 'Upstream response too large');
          return;
        }
        respChunks.push(chunk);
      });
      upstreamRes.on('end', () => {
        void (async () => {
          const responseBody = Buffer.concat(respChunks).toString('utf8');
          await onBufferedResponse(responseBody, upstreamRes);
        })();
      });
      upstreamRes.on('error', () => failClient(502));
      return;
    }

    clientRes.writeHead(upstreamRes.statusCode ?? 200, upstreamRes.headers);
    upstreamRes.pipe(clientRes);
    upstreamRes.on('error', () => {
      if (!clientRes.headersSent) failClient(502);
    });
  });

  if (body !== undefined) {
    upstreamReq.write(body);
    upstreamReq.end();
  } else if (clientReq) {
    clientReq.pipe(upstreamReq);
  } else {
    upstreamReq.end();
  }
}
