import type { Server } from 'http';
import type { ProxyManager } from '../proxy/proxy-manager.js';
import { Logger } from './logger.js';
import { relayMcpHttpRequest } from './mcp-http-relay.js';

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
      void relayMcpHttpRequest(req, res, proxyManager);
      return;
    }

    for (const listener of originalListeners) {
      listener(req, res);
    }
  });

  Logger.info(`[mcp-bridge] MCP endpoint mounted at POST ${path}`);
}
