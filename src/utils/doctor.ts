import { execSync } from 'node:child_process';
import { existsSync, accessSync, constants, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import chalk from 'chalk';
import { resolveGuardianDbPath } from './guardian-db-path.js';
import { isAiLearningEnabled, isAiAutoApplyEnabled } from './ai-enabled.js';
import { isFieldEncryptionEnabled } from './field-encryption.js';
import { resolveGuardianInstallRoot } from './guardian-package-root.js';
import { isDashboardSpaBuilt } from './start-env.js';
import { readOnboardArtifact } from '../cli/onboard.js';
import { pickGuardianConfig } from './pick-guardian-config.js';

export interface DoctorOptions {
  policyPath?: string;
  configPath?: string;
}

function checkPortInUse(port: number): boolean {
  try {
    if (process.platform === 'win32') return false;
    const out = execSync(`lsof -ti :${port} 2>/dev/null || true`, { encoding: 'utf8' }).trim();
    return out.length > 0;
  } catch {
    return false;
  }
}

export function runDoctor(opts: DoctorOptions = {}): number {
  let issues = 0;
  const installRoot = resolveGuardianInstallRoot();
  const distCli = join(installRoot, 'dist', 'cli.js');
  const dbPath = resolveGuardianDbPath();
  const policyPath = opts.policyPath
    || process.env.GUARDIAN_POLICY_PATH
    || process.env.MCP_GUARDIAN_POLICY_PATH
    || 'default-policy.yaml';

  console.log(chalk.bold('\nMCP Guardian Doctor\n'));

  if (existsSync(distCli)) {
    console.log(chalk.green(`  Install root: ${installRoot}`));
    console.log(chalk.green('  dist/cli.js: OK'));
  } else {
    console.log(chalk.red(`  dist/cli.js missing under ${installRoot}`));
    console.log(chalk.dim('    Fix: mcp-guardian setup   (git clone) or npm install -g @mcp-guardian/server'));
    issues++;
  }

  if (isDashboardSpaBuilt(installRoot)) {
    console.log(chalk.green('  Dashboard SPA: built (deploy/dashboard-spa/out/)'));
  } else {
    console.log(chalk.yellow('  Dashboard SPA: not built (legacy HTML fallback only)'));
    console.log(chalk.dim('    Fix: mcp-guardian setup   or   mcp-guardian start --build-dashboard'));
    issues++;
  }

  const dbDir = dbPath === ':memory:' ? null : dirname(dbPath);
  if (dbPath === ':memory:') {
    console.log(chalk.yellow('  DB: in-memory (tests only)'));
  } else {
    try {
      if (dbDir && !existsSync(dbDir)) {
        console.log(chalk.yellow(`  DB dir missing (will be created): ${dbDir}`));
      }
      accessSync(dbDir || dbPath, constants.W_OK);
      console.log(chalk.green(`  DB path writable: ${dbPath}`));
    } catch {
      console.log(chalk.red(`  DB path not writable: ${dbPath}`));
      console.log(chalk.dim(`    Fix: rm -f "${dbPath}-wal" "${dbPath}-shm" and retry`));
      issues++;
    }
  }

  const resolvedPolicy = existsSync(policyPath)
    ? resolve(policyPath)
    : resolve(installRoot, policyPath);
  if (existsSync(resolvedPolicy)) {
    console.log(chalk.green(`  Policy file: ${resolvedPolicy}`));
  } else {
    console.log(chalk.red(`  Policy file missing: ${resolvedPolicy}`));
    issues++;
  }

  const onboard = readOnboardArtifact();
  if (onboard) {
    console.log(chalk.green(`  Onboard: ${onboard.client} (${onboard.onboardedAt})`));
    if (onboard.configsDir && existsSync(onboard.configsDir)) {
      const n = readdirSync(onboard.configsDir).filter((f) => f.endsWith('.json')).length;
      console.log(chalk.dim(`    guardian-configs: ${n} file(s) in ${onboard.configsDir}`));
    }
  } else {
    console.log(chalk.yellow('  Onboard: not run yet'));
    console.log(chalk.dim('    Fix: mcp-guardian onboard --apply'));
  }

  const picked = pickGuardianConfig({
    configPath: opts.configPath,
    searchRoots: [process.cwd(), installRoot],
  });
  if (opts.configPath) {
    const cfg = resolve(process.cwd(), opts.configPath);
    if (existsSync(cfg)) {
      console.log(chalk.green(`  MCP config: ${cfg}`));
    } else {
      console.log(chalk.red(`  MCP config missing: ${cfg}`));
      issues++;
    }
  } else if (picked) {
    console.log(chalk.green(`  MCP config (auto): ${picked}`));
  } else {
    console.log(chalk.yellow('  MCP config: none (single stdio server)'));
    console.log(chalk.dim('    Fix: mcp-guardian onboard --apply'));
    issues++;
  }

  const port = parseInt(process.env.DASHBOARD_PORT || '4000', 10);
  if (checkPortInUse(port)) {
    console.log(chalk.yellow(`  Port ${port}: in use (proxy may already be running)`));
  } else {
    console.log(chalk.dim(`  Port ${port}: available`));
  }

  const dashboard = process.env.DASHBOARD_ENABLED === 'true';
  const ws = process.env.GUARDIAN_WS_ENABLED !== 'false';
  console.log(chalk.dim(`  Dashboard API: ${dashboard ? 'enabled' : 'disabled'} (set by mcp-guardian start)`));
  console.log(chalk.dim(`  Live WebSocket: ${ws ? 'enabled' : 'disabled'}`));

  if (process.env.GUARDIAN_ENTERPRISE_MODE === 'true' && !isFieldEncryptionEnabled()) {
    console.log(
      chalk.yellow(
        '  Enterprise mode: GUARDIAN_DB_ENCRYPTION_KEY unset — audit block_reason/args stored in plaintext',
      ),
    );
    issues++;
  }

  if (isAiLearningEnabled()) {
    console.log(chalk.green('  AI learning: enabled (default)'));
    console.log(chalk.dim(`    Auto-apply rules: ${isAiAutoApplyEnabled() ? 'ON' : 'off'}`));
  } else {
    console.log(chalk.yellow('  AI learning: disabled (GUARDIAN_AI_ENABLED=false)'));
  }

  console.log(chalk.cyan('\n  Quick start:'));
  console.log(chalk.dim('    npm install -g @mcp-guardian/server@latest'));
  console.log(chalk.dim('    mcp-guardian onboard --apply'));
  console.log(chalk.dim('    mcp-guardian start\n'));

  if (issues > 0) {
    console.log(chalk.yellow(`  ${issues} issue(s) — fix items above, then: mcp-guardian start\n`));
  }

  return issues > 0 ? 1 : 0;
}
