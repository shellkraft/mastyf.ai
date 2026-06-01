/**
 * `mcp-guardian start` — proxy + dashboard with sensible local defaults.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import { resolveGuardianInstallRoot } from '../utils/guardian-package-root.js';
import { pickGuardianConfig } from '../utils/pick-guardian-config.js';
import { applyStartEnv, isDashboardSpaBuilt, resolveStartPolicy } from '../utils/start-env.js';

export interface StartOptions {
  config?: string;
  policy?: string;
  blockingMode?: string;
  buildDashboard?: boolean;
  installRoot?: string;
  searchRoots?: string[];
}

function isMonorepoRoot(root: string): boolean {
  return (
    existsSync(join(root, 'pnpm-workspace.yaml'))
    && existsSync(join(root, 'package.json'))
  );
}

async function maybeBuildDashboard(installRoot: string, force: boolean): Promise<void> {
  if (!force && isDashboardSpaBuilt(installRoot)) return;
  const script = join(installRoot, 'scripts', 'build-dashboard-spa.sh');
  if (!existsSync(script)) {
    if (!isDashboardSpaBuilt(installRoot)) {
      console.error(
        chalk.yellow(
          '  Dashboard SPA not built; npm package should include deploy/dashboard-spa/out/. ' +
            'Reinstall @mcp-guardian/server or run from a git clone with `mcp-guardian setup`.',
        ),
      );
    }
    return;
  }
  console.log(chalk.dim('[start] Building dashboard SPA…'));
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn('sh', [script], { cwd: installRoot, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolvePromise() : reject(new Error(`dashboard build exited ${code}`))));
  });
}

export async function runStart(opts: StartOptions = {}): Promise<void> {
  const installRoot = resolve(opts.installRoot ?? resolveGuardianInstallRoot());
  const distCli = join(installRoot, 'dist', 'cli.js');
  if (!existsSync(distCli)) {
    console.error(chalk.red(`MCP Guardian not built: missing ${distCli}`));
    console.error(chalk.dim('  Git clone: run `mcp-guardian setup` or `pnpm install && pnpm build`'));
    console.error(chalk.dim('  npm: reinstall `npm install -g @mcp-guardian/server@latest`'));
    process.exit(1);
  }

  applyStartEnv();

  const autoBuild =
    opts.buildDashboard
    || process.env.GUARDIAN_AUTO_BUILD_DASHBOARD === 'true'
    || (isMonorepoRoot(installRoot) && !isDashboardSpaBuilt(installRoot));
  if (autoBuild) {
    try {
      await maybeBuildDashboard(installRoot, !!opts.buildDashboard);
    } catch (err: unknown) {
      console.error(chalk.red(`Dashboard build failed: ${(err as Error).message}`));
      process.exit(1);
    }
  } else if (!isDashboardSpaBuilt(installRoot)) {
    console.log(chalk.yellow('  Note: full dashboard UI needs deploy/dashboard-spa/out/ (legacy HTML fallback may be used).'));
  }

  const policy = opts.policy ?? resolveStartPolicy(installRoot);
  const policyAbs = existsSync(policy) ? policy : join(installRoot, policy);

  const searchRoots = opts.searchRoots ?? [process.cwd(), installRoot];
  const config = pickGuardianConfig({ configPath: opts.config, searchRoots });
  if (!config) {
    console.error(chalk.red('\nNo single-server Guardian MCP config found.\n'));
    console.error(chalk.dim('  1. mcp-guardian onboard --apply'));
    console.error(chalk.dim('  2. mcp-guardian start --config guardian-configs/filesystem.json\n'));
    process.exit(1);
  }

  const blockingMode =
    opts.blockingMode || process.env.GUARDIAN_BLOCKING_MODE || 'block';
  const port = process.env.DASHBOARD_PORT || '4000';

  console.log(chalk.bold('\nMCP Guardian — starting proxy + dashboard\n'));
  console.log(chalk.dim(`  Dashboard: http://localhost:${port}/`));
  console.log(chalk.dim(`  DB: ${process.env.MCP_GUARDIAN_DB_PATH}`));
  console.log(chalk.dim(`  Config: ${config}`));
  console.log(chalk.dim(`  Policy: ${policyAbs}\n`));

  const args = [
    distCli,
    'proxy',
    '--config',
    config,
    '--policy',
    policyAbs,
    '--blocking-mode',
    blockingMode,
  ];

  const child = spawn(process.execPath, args, {
    cwd: installRoot,
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}
