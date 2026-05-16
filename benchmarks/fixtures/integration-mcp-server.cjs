#!/usr/bin/env node
// Minimal MCP stdio server for proxy-audit integration tests.
const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
    if (msg.method === 'tools/list') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0', id: msg.id,
        result: { tools: [{ name: 'echo' }, { name: 'add' }, { name: 'search' }] },
      }) + '\n');
    } else if (msg.method === 'initialize') {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0', id: msg.id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'test', version: '1.0' },
          capabilities: { tools: {} },
        },
      }) + '\n');
    } else {
      process.stdout.write(JSON.stringify({
        jsonrpc: '2.0', id: msg.id,
        result: { content: [{ type: 'text', text: 'response to ' + msg.method }] },
      }) + '\n');
    }
  } catch (e) {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id: (msg && msg.id) || 'unknown',
      error: { code: -32700, message: String(e) },
    }) + '\n');
  }
});

setTimeout(() => {}, 99999);
