#!/usr/bin/env node
/**
 * Minimal MCP-over-SSE echo server for integration tests.
 * GET /sse → endpoint event; POST /message?sessionId=… → JSON-RPC echo (arguments in result.content).
 */
const http = require('http');
const crypto = require('crypto');

const host = process.env.MCP_ECHO_HOST || '127.0.0.1';
const port = Number(process.env.MCP_ECHO_PORT || process.argv[2] || 0);

const sessions = new Map();

function reply(msg) {
  if (msg.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'mcp-sse-echo', version: '1.0.0' },
        capabilities: { tools: {} },
      },
    };
  }
  if (msg.method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        tools: [
          {
            name: 'echo',
            description: 'Echo arguments as JSON text',
            inputSchema: {
              type: 'object',
              properties: { text: { type: 'string' } },
            },
          },
        ],
      },
    };
  }
  if (msg.method === 'tools/call') {
    const args = (msg.params && msg.params.arguments) || {};
    return {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        content: [{ type: 'text', text: JSON.stringify(args) }],
      },
    };
  }
  return {
    jsonrpc: '2.0',
    id: msg.id,
    error: { code: -32601, message: 'Method not found: ' + msg.method },
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && (url.pathname === '/sse' || url.pathname === '/')) {
    const sid = crypto.randomUUID();
    sessions.set(sid, true);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(`event: endpoint\ndata: /message?sessionId=${sid}\n\n`);
    res.end();
    return;
  }
  if (req.method === 'POST' && url.pathname === '/message') {
    const sid = url.searchParams.get('sessionId');
    if (!sid || !sessions.has(sid)) {
      res.writeHead(400);
      res.end();
      return;
    }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const msg = JSON.parse(Buffer.concat(chunks).toString());
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(reply(msg)));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: String(e && e.message ? e.message : e) }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(port, host, () => {
  const addr = server.address();
  const p = typeof addr === 'object' && addr ? addr.port : port;
  process.stdout.write('READY:' + p + '\n');
});
