#!/usr/bin/env node
/**
 * Probe each mastyff-ai-configs/*.json upstream (tools/list + optional benign call).
 * Writes reports/security-swarm/user-servers-session.json — soft-fail per server.
 */
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveSwarmDir } from '../../security-swarm/lib/swarm-dir.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');
const CONFIGS_DIR = join(REPO, 'mastyff-ai-configs');
const OUT_PATH = join(resolveSwarmDir(), 'user-servers-session.json');

async function probeOne(server, configPath) {
  const started = Date.now();
  const entry = {
    serverName: server.name,
    configPath,
    transport: server.transport || (server.url ? 'sse' : 'stdio'),
    status: 'pending',
    toolCount: 0,
    toolNames: [],
    probes: [],
    error: null,
    latencyMs: 0,
  };

  if (!server.command && !server.url) {
    entry.status = 'skipped';
    entry.error = 'SSE/url-only server — no stdio probe';
    return entry;
  }

  try {
    const { McpClient } = await import('../../dist/utils/mcp-client.js');
    const result = await McpClient.probe(server);
    entry.latencyMs = result.latencyMs;
    entry.toolCount = result.toolCount ?? 0;
    entry.toolNames = result.toolNames ?? [];
    if (!result.success) {
      entry.status = 'failed';
      entry.error = result.error || 'Probe failed';
      return entry;
    }

    entry.probes.push({ name: 'tools/list', ok: true, detail: `${entry.toolCount} tools` });

    const listTool = entry.toolNames.find((t) =>
      ['list_directory', 'list_allowed_directories', 'list_dir'].includes(t),
    );
    if (listTool) {
      entry.probes.push({
        name: 'benign-list',
        ok: true,
        detail: `Would call ${listTool} (skipped live call in audit-safe probe)`,
      });
    }

    entry.status = 'ok';
    return entry;
  } catch (err) {
    entry.status = 'failed';
    entry.error = err instanceof Error ? err.message : String(err);
    entry.latencyMs = Date.now() - started;
    return entry;
  }
}

export async function runUserServerProbes() {
  mkdirSync(dirname(OUT_PATH), { recursive: true });

  if (!existsSync(join(REPO, 'dist', 'cli.js'))) {
    throw new Error('dist/cli.js missing — run pnpm build first');
  }

  const { ConfigParser } = await import('../../dist/config-parser.js');
  const results = [];
  let configFiles = [];
  if (existsSync(CONFIGS_DIR)) {
    configFiles = readdirSync(CONFIGS_DIR).filter((f) => f.endsWith('.json'));
  }

  for (const file of configFiles) {
    const configPath = join(CONFIGS_DIR, file);
    try {
      const servers = ConfigParser.parse(configPath);
      for (const server of servers) {
        results.push(await probeOne(server, configPath));
      }
    } catch (err) {
      results.push({
        serverName: file.replace('.json', ''),
        configPath,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        probes: [],
        toolCount: 0,
        toolNames: [],
        latencyMs: 0,
      });
    }
  }

  const ok = results.filter((r) => r.status === 'ok').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  const session = {
    timestamp: new Date().toISOString(),
    configsDir: CONFIGS_DIR,
    summary: {
      total: results.length,
      ok,
      failed,
      skipped,
      allOk: failed === 0,
    },
    servers: results,
  };

  writeFileSync(OUT_PATH, JSON.stringify(session, null, 2));

  if (failed > 0 && process.env.SWARM_USER_SERVERS_STRICT === 'true') {
    const names = results.filter((r) => r.status === 'failed').map((r) => r.serverName);
    throw new Error(`User server probes failed: ${names.join(', ')}`);
  }

  return session;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runUserServerProbes()
    .then((s) => {
      console.log(
        `User servers: ${s.summary.ok}/${s.summary.total} OK (${s.summary.failed} failed, ${s.summary.skipped} skipped)`,
      );
      process.exit(s.summary.failed > 0 && process.env.SWARM_USER_SERVERS_STRICT === 'true' ? 1 : 0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
