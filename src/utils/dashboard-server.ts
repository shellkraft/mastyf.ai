import { createServer } from 'http';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Logger } from './logger.js';
import { PolicyWatcher } from '../policy/policy-watcher.js';
import { Registry } from 'prom-client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Lightweight dashboard server that serves:
 * - / — the dashboard HTML
 * - /api/policy — current policy (JSON)
 * - /api/policy/reload — trigger policy reload
 * - /metrics — Prometheus metrics
 */
export async function startDashboardServer(
  port: number = 4000,
  policyWatcher?: PolicyWatcher,
): Promise<void> {
  if (process.env['DASHBOARD_ENABLED'] !== 'true') {
    Logger.debug('[dashboard] Dashboard server not enabled (set DASHBOARD_ENABLED=true)');
    return;
  }

  const dashboardHtml = readFileSync(resolve(__dirname, '..', '..', 'deploy', 'dashboard.html'), 'utf-8');

  const server = createServer(async (req, res) => {
    const url = req.url || '/';

    try {
      // ── Dashboard HTML ──────────────────────────────────────
      if (url === '/' || url === '/dashboard.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(dashboardHtml);
        return;
      }

      // ── Policy API ──────────────────────────────────────────
      if (url === '/api/policy' && req.method === 'GET') {
        if (!policyWatcher || !policyWatcher.get()) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No active policy. Start proxy with --policy flag.' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ mode: policyWatcher.get()!.getMode(), rules: 'Policy engine active (YAML view available on filesystem)' }));
        return;
      }

      if (url === '/api/policy/reload' && req.method === 'POST') {
        if (!policyWatcher) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Policy watcher not configured' }));
          return;
        }
        // PolicyWatcher auto-reloads via chokidar — no manual reload needed
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', message: 'Policy watcher is active. File changes are auto-detected.' }));
        return;
      }

      // ── Prometheus /metrics proxy ──────────────────────────
      if (url === '/metrics') {
        try {
          // Fetch from the metrics server (port 9090 by default)
          const metricsPort = process.env['METRICS_PORT'] || '9090';
          const metricsRes = await fetch(`http://localhost:${metricsPort}/metrics`);
          if (!metricsRes.ok) throw new Error(`Metrics server returned ${metricsRes.status}`);
          const text = await metricsRes.text();
          res.writeHead(200, {
            'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(text);
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Metrics not available. Ensure METRICS_ENABLED=true and proxy is running.' }));
        }
        return;
      }

      // ── 404 ─────────────────────────────────────────────────
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err?.message || 'Internal error' }));
    }
  });

  server.listen(port, () => {
    Logger.info(`[dashboard] Dashboard available at http://localhost:${port}`);
  });
}