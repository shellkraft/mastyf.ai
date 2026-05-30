import { existsSync, accessSync, constants } from 'fs';
import { resolve, dirname } from 'path';
import chalk from 'chalk';
import { resolveGuardianDbPath } from './guardian-db-path.js';
import { isAiLearningEnabled, isAiAutoApplyEnabled } from './ai-enabled.js';
import { isFieldEncryptionEnabled } from './field-encryption.js';

export interface DoctorOptions {
  policyPath?: string;
  configPath?: string;
}

export function runDoctor(opts: DoctorOptions = {}): number {
  let issues = 0;
  const dbPath = resolveGuardianDbPath();
  const policyPath = opts.policyPath
    || process.env.GUARDIAN_POLICY_PATH
    || process.env.MCP_GUARDIAN_POLICY_PATH
    || 'default-policy.yaml';

  console.log(chalk.bold('\nMCP Guardian Doctor\n'));

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
      issues++;
    }
  }

  const resolvedPolicy = resolve(process.cwd(), policyPath);
  if (existsSync(resolvedPolicy)) {
    console.log(chalk.green(`  Policy file: ${resolvedPolicy}`));
  } else {
    console.log(chalk.red(`  Policy file missing: ${resolvedPolicy}`));
    issues++;
  }

  if (opts.configPath) {
    const cfg = resolve(process.cwd(), opts.configPath);
    if (existsSync(cfg)) {
      console.log(chalk.green(`  MCP config: ${cfg}`));
    } else {
      console.log(chalk.red(`  MCP config missing: ${cfg}`));
      issues++;
    }
  }

  const dashboard = process.env.DASHBOARD_ENABLED === 'true';
  const ws = process.env.GUARDIAN_WS_ENABLED !== 'false';
  console.log(chalk.dim(`  Dashboard API: ${dashboard ? 'enabled' : 'disabled'} (DASHBOARD_ENABLED=true)`));
  console.log(chalk.dim(`  Live WebSocket: ${ws ? 'enabled' : 'disabled'} (GUARDIAN_WS_ENABLED)`));

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
    console.log(chalk.dim(`    Auto-apply rules: ${isAiAutoApplyEnabled() ? 'ON' : 'off (set GUARDIAN_AI_AUTO_APPLY=true to enable)'}`));
  } else {
    console.log(chalk.yellow('  AI learning: disabled (GUARDIAN_AI_ENABLED=false)'));
  }

  console.log(chalk.dim('\n  Quick start (no seed data):'));
  console.log(chalk.dim('    pnpm run build && pnpm run dogfood && pnpm run tui'));
  console.log(chalk.dim('    mcp-guardian wrap --apply && mcp-guardian proxy --config mcp.json --policy default-policy.yaml\n'));

  return issues > 0 ? 1 : 0;
}
