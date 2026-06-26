/**
 * HTTP/SSE Transparent Proxy for Cost Auditing (v2.1).
 *
 * Intercepts HTTP requests to upstream MCP servers, inspects JSON-RPC tools/call
 * payloads, runs token counting and policy evaluation, then forwards to the target.
 */
import * as http from 'http';
import * as https from 'https';
import type { Agent } from 'https';
import type { HttpProxyAuthValidator } from './http-proxy-auth.js';
import { runHttpProxyAuthGate, sendAuthGateFailure } from './http-proxy-auth.js';
import {
  getMaxBodyBytes,
  getUpstreamTimeoutMs,
  loadInboundTlsFromEnv,
  readRequestBodyWithLimit,
  relayToUpstream,
  assertUpstreamTlsAllowed,
  isPlaintextUpstreamAllowed,
} from './http-proxy-utils.js';

interface TokenCounterLike { count(text: string): number; }
interface PolicyEngineLike { evaluate(c: any): { action: string; rule: string; reason: string }; }
interface DatabaseLike { addCallRecord(r: any): Promise<void>; }

export interface CreateHttpProxyOptions {
  authValidator?: HttpProxyAuthValidator | null;
  maxBodyBytes?: number;
  upstreamTimeoutMs?: number;
  tls?: { cert: Buffer | string; key: Buffer | string };
  upstreamAgent?: Agent;
}

export function createHttpProxy(
  targetUrl: string,
  policyEngine: PolicyEngineLike | null,
  db: DatabaseLike,
  tokenCounter: TokenCounterLike,
  options: CreateHttpProxyOptions = {},
): http.Server | https.Server {
  const target = targetUrl.replace(/\/$/, '');
  const upstreamTls = assertUpstreamTlsAllowed(target);
  if (!upstreamTls.ok) {
    throw new Error(upstreamTls.message);
  }
  if (isPlaintextUpstreamAllowed()) {
    console.warn(
      '[http-proxy] MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM=true — upstream tool traffic may use cleartext HTTP (dev only)',
    );
  }
  const maxBodyBytes = options.maxBodyBytes ?? getMaxBodyBytes();
  const upstreamTimeoutMs = options.upstreamTimeoutMs ?? getUpstreamTimeoutMs();
  const authValidator = options.authValidator ?? null;
  const upstreamAgent = options.upstreamAgent;
  const inboundTls = options.tls ?? loadInboundTlsFromEnv();

  const handler = async (clientReq: http.IncomingMessage, clientRes: http.ServerResponse) => {
    const start = Date.now();

    if (authValidator) {
      const authResult = await runHttpProxyAuthGate(clientReq, authValidator);
      if (!authResult.ok) {
        sendAuthGateFailure(clientRes, authResult);
        return;
      }
    }

    const buildUpstreamUrl = () => new URL(target + (clientReq.url ?? '/'));

    const forwardHeaders = (upstream: URL, extra?: Record<string, string>) => ({
      ...clientReq.headers,
      host: upstream.hostname,
      ...extra,
    });

    if (clientReq.method !== 'POST') {
      relayToUpstream({
        upstream: buildUpstreamUrl(),
        method: clientReq.method || 'GET',
        headers: forwardHeaders(buildUpstreamUrl()),
        clientRes,
        clientReq,
        timeoutMs: upstreamTimeoutMs,
        agent: upstreamAgent,
      });
      return;
    }

    const bodyResult = await readRequestBodyWithLimit(clientReq, maxBodyBytes);
    if (!bodyResult.ok) {
      clientRes.writeHead(413, { 'Content-Type': 'application/json' });
      clientRes.end(JSON.stringify({
        error: 'Request body too large',
        limit: bodyResult.limit,
        bytes: bodyResult.bytes,
      }));
      return;
    }
    const rawBody = bodyResult.body;

    let parsed: any;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      const upstream = buildUpstreamUrl();
      relayToUpstream({
        upstream,
        method: clientReq.method || 'POST',
        headers: forwardHeaders(upstream, { 'content-length': String(Buffer.byteLength(rawBody)) }),
        body: rawBody,
        clientRes,
        timeoutMs: upstreamTimeoutMs,
        agent: upstreamAgent,
      });
      return;
    }

    if (parsed.method === 'tools/call') {
      const toolName = parsed.params?.name || 'unknown';
      const inputTokens = tokenCounter.count(rawBody);

      if (policyEngine) {
        const policyResult = policyEngine.evaluate({
          toolName,
          arguments: parsed.params?.arguments || {},
          serverName: target,
          requestTokens: inputTokens,
          timestamp: new Date().toISOString(),
        });
        if (policyResult.action === 'block') {
          clientRes.writeHead(403, { 'Content-Type': 'application/json' });
          clientRes.end(JSON.stringify({
            jsonrpc: '2.0',
            id: parsed.id,
            error: {
              code: -32000,
              message: `Blocked: ${policyResult.reason}`,
              data: { rule: policyResult.rule },
            },
          }));
          return;
        }
      }

      const upstream = buildUpstreamUrl();
      relayToUpstream({
        upstream,
        method: 'POST',
        headers: forwardHeaders(upstream, { 'content-length': String(Buffer.byteLength(rawBody)) }),
        body: rawBody,
        clientRes,
        timeoutMs: upstreamTimeoutMs,
        agent: upstreamAgent,
        maxResponseBytes: maxBodyBytes,
        onBufferedResponse: async (responseBody, upstreamRes) => {
          let outputTokens = 0;
          try {
            const responseJson = JSON.parse(responseBody);
            if (responseJson.result?.content) {
              outputTokens = tokenCounter.count(
                (responseJson.result.content as any[]).map((c) => c.text || '').join(''),
              );
            }
          } catch {
            outputTokens = Math.round(responseBody.length * 0.25);
          }

          if (!clientRes.headersSent) {
            clientRes.writeHead(upstreamRes.statusCode ?? 200, upstreamRes.headers);
            clientRes.end(responseBody);
          }

          try {
            await db.addCallRecord({
              serverName: target,
              toolName,
              requestTokens: inputTokens,
              responseTokens: outputTokens,
              totalTokens: inputTokens + outputTokens,
              durationMs: Date.now() - start,
              timestamp: new Date().toISOString(),
            });
          } catch {
            /* DB log failure is non-fatal */
          }
        },
      });
      return;
    }

    const upstream = buildUpstreamUrl();
    relayToUpstream({
      upstream,
      method: clientReq.method || 'POST',
      headers: forwardHeaders(upstream, { 'content-length': String(Buffer.byteLength(rawBody)) }),
      body: rawBody,
      clientRes,
      timeoutMs: upstreamTimeoutMs,
      agent: upstreamAgent,
    });
  };

  if (inboundTls) {
    return https.createServer(
      { cert: inboundTls.cert, key: inboundTls.key },
      handler,
    );
  }

  return http.createServer(handler);
}

export type { HttpProxyAuthValidator } from './http-proxy-auth.js';
