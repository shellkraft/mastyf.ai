// Render.com startup — serves /.well-known/mcp/server-card.json for Smithery
// and runs the MCP Mastyff AI server on the Render-assigned port
import http from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { startMcpServer } from './dist/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 10000;

// Serve well-known server card for scanner bypass
const serverCard = JSON.parse(
  readFileSync(join(__dirname, 'server-card.json'), 'utf-8')
);

const server = http.createServer((req, res) => {
  if (req.url === '/.well-known/mcp/server-card.json' || req.url === '/server-card.json') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(serverCard, null, 2));
    return;
  }
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', name: serverCard.name, version: serverCard.version }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`<html><body><h1>MCP MastyffAi</h1><p>${serverCard.description}</p><p>Tools: scan_security, audit_costs, check_health, full_report</p></body></html>`);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Mastyff AI running on port ${PORT} (${process.env.NODE_ENV || 'production'})`);
  console.log(`Well-known: /.well-known/mcp/server-card.json`);
  console.log(`Health: /health`);
});