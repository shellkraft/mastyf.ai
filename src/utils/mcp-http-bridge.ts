import type { Server } from 'http';
import type { ProxyManager } from '../proxy/proxy-manager.js';
import { Logger } from './logger.js';
import { RequestIdLock } from './request-id-lock.js';

/** Serialises MCP requests so stdout capture is never contended across concurrent HTTP calls. */
const mcpSerialQueue = new RequestIdLock();

export function mountMcpEndpoint(
  httpServer: Server,
  path: string,
  proxyManager: ProxyManager,
): void {
  if (!httpServer || !proxyManager) return;

  const originalListeners = httpServer.listeners('request').slice();
  httpServer.removeAllListeners('request');

  httpServer.on('request', (req, res) => {
    const url = (req.url || '/').split('?')[0] || '/';

    if (req.method === 'POST' && url === path) {
      void handleMcpRequest(req, res, proxyManager);
      return;
    }

    for (const listener of originalListeners) {
      listener(req, res);
    }
  });

  Logger.info(`[mcp-bridge] MCP endpoint mounted at POST ${path}`);
}

async function handleMcpRequest(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  proxyManager: ProxyManager,
): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const body = Buffer.concat(chunks).toString('utf-8').trim();

  if (!body) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Empty request body' } }));
    return;
  }

  let parsed: { id?: unknown };
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }));
    return;
  }

  const proxies = proxyManager.getProxies();
  if (proxies.length === 0) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: parsed.id ?? null, error: { code: -32003, message: 'No proxy available' } }));
    return;
  }

  const proxy = proxies[0];
  const requestId = parsed.id;

  // Queue globally so only one HTTP→MCP request is in flight at a time.
  // This prevents races on the global process.stdout.write override.
  await mcpSerialQueue.enqueue(undefined, async () => {
    const originalWrite = process.stdout.write.bind(process.stdout);
    let capturedResponse: string | null = null;
    let resolvePromise: ((val: string) => void) | null = null;
    const responsePromise = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });

    const mockWrite = (chunk: unknown) => {
      const str = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : String(chunk);
      const lines = str.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          // Only capture exact id match — no unsafe fallback.
          if (msg.id === requestId || msg.id == requestId) {
            capturedResponse = line;
            if (resolvePromise) resolvePromise(line);
            break;
          }
        } catch {
          // Not JSON — pass through
        }
      }
      return true;
    };

    const timeoutMs = 15000;
    try {
      process.stdout.write = mockWrite as typeof process.stdout.write;
      void proxy.handleClientInput(body);

      const result = await Promise.race([
        responsePromise,
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeoutMs),
        ),
      ]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(result);
    } catch {
      if (capturedResponse) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(capturedResponse);
      } else {
        Logger.warn(`[mcp-bridge] Request ${JSON.stringify(requestId)} timed out after ${timeoutMs}ms`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            id: requestId ?? null,
            error: { code: -32003, message: 'No response from proxy' },
          }),
        );
      }
    } finally {
      process.stdout.write = originalWrite;
    }
  });
}
