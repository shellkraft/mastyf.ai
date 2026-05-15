/**
 * MCP Guardian Interactive Polished CLI/TUI
 * 
 * A real-time terminal dashboard aggregating metrics, logs, and audit trails
 * from all MCP Guardian instances into a unified view.
 * 
 * Zero mock data — all values come from live dashboard API or PostgreSQL.
 */
import { DataFetcher, TuiData } from './data-fetcher.js';
import * as readline from 'readline';
import chalk from 'chalk';

// ── Color helpers ──────────────────────────────────────────────────
const C = {
  dim: chalk.dim,
  bold: chalk.bold,
  green: chalk.green,
  red: chalk.red,
  yellow: chalk.yellow,
  cyan: chalk.cyan,
  magenta: chalk.magenta,
  white: chalk.white,
  gray: chalk.gray,
  blue: chalk.blue,
  bgRed: chalk.bgRed,
  bgGreen: chalk.bgGreen,
  bgYellow: chalk.bgYellow,
};

// ── State ──────────────────────────────────────────────────────────
interface AppState {
  activeTab: number;
  running: boolean;
  lastRefresh: string;
  frameCount: number;
}

export async function startTui(dashboardUrl?: string): Promise<void> {
  const fetcher = new DataFetcher(dashboardUrl);
  const state: AppState = { activeTab: 0, running: true, lastRefresh: '', frameCount: 0 };

  // ── Terminal setup ───────────────────────────────────────────────
  const stdout = process.stdout;
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf-8');

  // Hide cursor
  stdout.write('\x1B[?25l');

  // ── Key handler ──────────────────────────────────────────────────
  stdin.on('data', (key: string) => {
    const code = key.charCodeAt(0);
    if (code === 3 || code === 27) {
      // Ctrl+C or Escape → quit
      state.running = false;
    } else if (code === 9) {
      // Tab → next tab
      state.activeTab = (state.activeTab + 1) % 8;
    } else if (key === '1') state.activeTab = 0;
    else if (key === '2') state.activeTab = 1;
    else if (key === '3') state.activeTab = 2;
    else if (key === '4') state.activeTab = 3;
    else if (key === '5') state.activeTab = 4;
    else if (key === '6') state.activeTab = 5;
    else if (key === '7') state.activeTab = 6;
    else if (key === '8') state.activeTab = 7;
    else if (key === 'r') {
      // Manual refresh
      fetcher.fetchAll().catch(() => {});
    }
  });

  // ── Connect to dashboard ─────────────────────────────────────────
  fetcher.connectWebSocket();
  // Fallback polling
  const pollInterval = fetcher.startPolling(3000);

  // Initial fetch
  try {
    await fetcher.fetchAll();
  } catch {
    // Will show empty dashboard until data arrives
  }

  // Subscribe to data changes
  fetcher.onChange(() => {
    render(state, fetcher.getData());
  });

  // ── Render loop ──────────────────────────────────────────────────
  const renderInterval = setInterval(() => {
    if (!state.running) {
      clearInterval(renderInterval);
      clearInterval(pollInterval);
      fetcher.stop();
      stdout.write('\x1B[?25h'); // Show cursor
      stdout.write('\x1B[2J\x1B[H'); // Clear screen
      process.exit(0);
    }
    render(state, fetcher.getData());
    state.frameCount++;
  }, 1000 / 15); // 15 FPS

  // Initial render
  render(state, fetcher.getData());

  // Keep process alive
  await new Promise<void>((resolve) => {
    const check = setInterval(() => {
      if (!state.running) {
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
}

// ── TABS ────────────────────────────────────────────────────────────
const TABS = [
  { name: 'Overview', key: '1' },
  { name: 'Security', key: '2' },
  { name: 'Cost', key: '3' },
  { name: 'Health', key: '4' },
  { name: 'AI Engine', key: '5' },
  { name: 'Audit Trail', key: '6' },
  { name: 'Policy', key: '7' },
  { name: 'Instances', key: '8' },
];

// ── Main render function ───────────────────────────────────────────
function render(state: AppState, data: TuiData | null): void {
  const stdout = process.stdout;
  const termWidth = stdout.columns || 120;
  const termHeight = stdout.rows || 30;

  // Clear screen
  stdout.write('\x1B[2J\x1B[H');

  // ── Header ──────────────────────────────────────────────────────
  const header = [
    C.bold.cyan('╔══════════════════════════════════════════════════════════════════════════════════╗'),
    C.bold.cyan(`║  MCP GUARDIAN — UNIFIED OBSERVABILITY PLATFORM${' '.repeat(Math.max(0, termWidth - 39 - 39))}║`),
    C.bold.magenta(`║  Adaptive AI-Driven Policy Engine | Real-Time Metrics | Multi-Instance Aggregation ║`),
  ];
  for (const line of header) stdout.write(line + '\n');

  // ── Top bar ─────────────────────────────────────────────────────
  if (data) {
    const instancesText = `${data.instances.length} instances`;
    const blockedText = `${data.overview.blockedRequests} blocked`;
    const costText = `$${data.overview.totalCostUsd.toFixed(4)}`;
    const latencyText = `${data.overview.avgLatencyMs.toFixed(0)}ms avg`;

    const bar = C.dim(
      `  ${C.green(instancesText)} │ ${C.red(blockedText)} │ ${C.yellow(costText)} │ ${C.cyan(latencyText)} │ ` +
      `Updated: ${data.overview.lastUpdated?.slice(11, 19) || 'N/A'}`
    );
    stdout.write(bar + '\n');
  }

  stdout.write(C.dim('─'.repeat(termWidth - 1)) + '\n');

  // ── Tab bar ──────────────────────────────────────────────────────
  let tabBar = '';
  for (let i = 0; i < TABS.length; i++) {
    if (i === state.activeTab) {
      tabBar += C.bgGreen.black(` ${TABS[i].key}. ${TABS[i].name} `) + ' ';
    } else {
      tabBar += C.dim(`${TABS[i].key}.`) + ` ${TABS[i].name}  `;
    }
  }
  stdout.write('  ' + tabBar + '\n');
  stdout.write(C.dim('─'.repeat(termWidth - 1)) + '\n\n');

  // ── Tab content ─────────────────────────────────────────────────
  if (!data) {
    stdout.write(C.yellow('\n  ⏳ Connecting to dashboard... Fetching real-time data.\n'));
    stdout.write(C.dim('  Ensure mcp-guardian proxy is running with DASHBOARD_ENABLED=true\n\n'));
  } else {
    switch (state.activeTab) {
      case 0: renderOverview(data); break;
      case 1: renderSecurity(data); break;
      case 2: renderCost(data); break;
      case 3: renderHealth(data); break;
      case 4: renderAi(data); break;
      case 5: renderAudit(data); break;
      case 6: renderPolicy(data); break;
      case 7: renderInstances(data); break;
    }
  }

  // ── Footer ──────────────────────────────────────────────────────
  stdout.write('\n' + C.dim('─'.repeat(termWidth - 1)) + '\n');
  stdout.write(C.dim('  1-8:Switch Tab  Tab:Next  r:Refresh  Esc:Quit     Frame: ' + state.frameCount + '\n'));
}

// ── PANEL RENDERERS ────────────────────────────────────────────────

function renderOverview(data: TuiData): void {
  const stdout = process.stdout;
  const o = data.overview;

  // Score gauge
  const score = data.security.overallScore;
  const scoreColor = score >= 70 ? C.green : score >= 40 ? C.yellow : C.red;
  const bar = '█'.repeat(Math.round(score / 5)) + '░'.repeat(20 - Math.round(score / 5));

  stdout.write(C.bold.white('  📊 EXECUTIVE SUMMARY\n\n'));
  stdout.write(`  Overall Security Score: ${scoreColor(`${score}/100`)}  ${C.dim(`[${bar}]`)}\n`);
  stdout.write(`  Active Instances:      ${C.green(o.activeInstances)} / ${C.white(o.totalInstances)}\n`);
  stdout.write(`  Total Requests:        ${C.white(o.totalRequests.toLocaleString())}\n`);
  stdout.write(`  Blocked Requests:      ${o.blockedRequests > 0 ? C.red(o.blockedRequests.toLocaleString()) : C.green('0')}\n`);
  stdout.write(`  Pass Rate:             ${o.passRate > 90 ? C.green(`${o.passRate.toFixed(1)}%`) : C.yellow(`${o.passRate.toFixed(1)}%`)}\n`);
  stdout.write(`  Total Cost:            ${C.yellow(`$${o.totalCostUsd.toFixed(4)}`)}\n`);
  stdout.write(`  Burn Rate:             ${C.yellow(`$${o.burnRatePerHour.toFixed(4)}/hr`)}\n`);
  stdout.write(`  Avg Latency:           ${o.avgLatencyMs < 200 ? C.green(`${o.avgLatencyMs.toFixed(0)}ms`) : C.yellow(`${o.avgLatencyMs.toFixed(0)}ms`)}\n`);
  stdout.write(`  Active Servers:        ${C.cyan(o.activeServers)}\n`);

  // Top risks
  if (data.security.worstOffenders.length > 0) {
    stdout.write(C.bold.red(`\n  ⚠️  TOP RISKS:\n`));
    for (const w of data.security.worstOffenders.slice(0, 5)) {
      stdout.write(C.red(`     • ${w}\n`));
    }
  }

  // AI Insights
  if (data.ai.report?.executiveSummary?.topRisks?.length > 0) {
    stdout.write(C.bold.yellow(`\n  🤖 AI INSIGHTS:\n`));
    for (const r of data.ai.report.executiveSummary.recommendations?.slice(0, 3) || []) {
      stdout.write(C.yellow(`     • ${r}\n`));
    }
  }

  // Budget alerts
  if (data.cost.budgetAlerts.length > 0) {
    stdout.write(C.bold.red(`\n  💰 BUDGET ALERTS:\n`));
    for (const alert of data.cost.budgetAlerts) {
      stdout.write(C.red(`     • ${alert}\n`));
    }
  }
}

function renderSecurity(data: TuiData): void {
  const stdout = process.stdout;
  const s = data.security;

  stdout.write(C.bold.white('  🔒 SECURITY POSTURE\n\n'));
  stdout.write(`  Overall Score:  ${s.overallScore >= 70 ? C.green(s.overallScore) : C.red(s.overallScore)}/100\n`);
  stdout.write(`  Active Threats: ${s.activeThreats > 0 ? C.red(s.activeThreats) : C.green('0')}\n`);
  stdout.write(`  Last Scan:      ${C.dim(s.lastScan)}\n\n`);

  if (s.servers.length === 0) {
    stdout.write(C.dim('  No security data available — run scan_security to populate.\n'));
    return;
  }

  // Table header
  stdout.write(C.dim('  ┌──────────────────────────┬─────────┬───────┬──────────┬────────┐\n'));
  stdout.write(C.dim('  │ Server                   │ Score   │ CVEs  │ Critical │ Auth   │\n'));
  stdout.write(C.dim('  ├──────────────────────────┼─────────┼───────┼──────────┼────────┤\n'));

  for (const server of s.servers) {
    const scoreColor = server.score >= 70 ? C.green : server.score >= 40 ? C.yellow : C.red;
    const name = server.name.slice(0, 24).padEnd(24);
    const score = scoreColor(String(server.score).padEnd(7));
    const cves = server.cves > 0 ? C.red(String(server.cves).padEnd(5)) : C.dim(String(server.cves).padEnd(5));
    const critical = server.critical > 0 ? C.bgRed.white(` ${server.critical} `) : C.dim(' 0 ');
    const auth = server.auth ? C.green('✅') : C.red('❌');

    stdout.write(`  │ ${C.white(name)}│ ${score}│ ${cves}│ ${critical}     │ ${auth}   │\n`);
  }

  stdout.write(C.dim('  └──────────────────────────┴─────────┴───────┴──────────┴────────┘\n'));
}

function renderCost(data: TuiData): void {
  const stdout = process.stdout;
  const c = data.cost;

  stdout.write(C.bold.white('  💰 COST ANALYSIS\n\n'));
  stdout.write(`  Total Cost:         ${C.yellow(`$${c.totalCost.toFixed(4)}`)}\n`);
  stdout.write(`  Projected Monthly:  ${C.yellow(`$${c.projectedMonthly.toFixed(2)}`)}\n`);
  stdout.write(`  Pricing Model:      ${C.cyan(c.pricingModel)}\n\n`);

  if (c.servers.length === 0) {
    stdout.write(C.dim('  No cost data available — run audit_costs to populate.\n'));
    return;
  }

  // Table
  stdout.write(C.dim('  ┌──────────────────────────┬────────────┬──────────┬─────────┐\n'));
  stdout.write(C.dim('  │ Server                   │ Tokens     │ Cost USD │ Trend   │\n'));
  stdout.write(C.dim('  ├──────────────────────────┼────────────┼──────────┼─────────┤\n'));

  for (const server of c.servers) {
    const name = server.name.slice(0, 24).padEnd(24);
    const tokens = String(server.tokens.toLocaleString()).padEnd(10);
    const cost = `$${server.cost.toFixed(4)}`.padEnd(8);
    const trendIcon = server.trend === 'increasing' ? '📈' : server.trend === 'decreasing' ? '📉' : '➡️';

    stdout.write(`  │ ${C.white(name)}│ ${C.cyan(tokens)}│ ${C.yellow(cost)}│ ${trendIcon}     │\n`);
  }

  stdout.write(C.dim('  └──────────────────────────┴────────────┴──────────┴─────────┘\n'));
}

function renderHealth(data: TuiData): void {
  const stdout = process.stdout;
  const h = data.health;

  stdout.write(C.bold.white('  ❤️  HEALTH STATUS\n\n'));
  stdout.write(`  Avg Latency:  ${h.avgLatency < 200 ? C.green(`${h.avgLatency}ms`) : C.yellow(`${h.avgLatency}ms`)}\n`);
  stdout.write(`  Total Tools:  ${C.cyan(h.totalTools)}\n`);
  stdout.write(`  At Risk:      ${h.atRisk.length > 0 ? C.red(h.atRisk.join(', ')) : C.green('None')}\n\n`);

  if (h.servers.length === 0) {
    stdout.write(C.dim('  No health data available — run check_health to populate.\n'));
    return;
  }

  // Table
  stdout.write(C.dim('  ┌──────────────────────────┬──────────┬──────────┬───────┬───────────┐\n'));
  stdout.write(C.dim('  │ Server                   │ Latency  │ Success  │ Tools │ Breaker   │\n'));
  stdout.write(C.dim('  ├──────────────────────────┼──────────┼──────────┼───────┼───────────┤\n'));

  for (const server of h.servers) {
    const name = server.name.slice(0, 24).padEnd(24);
    const latency = server.latency < 200 ? C.green(`${server.latency}ms`.padEnd(8)) : C.yellow(`${server.latency}ms`.padEnd(8));
    const success = server.successRate > 90 ? C.green(`${server.successRate.toFixed(0)}%`.padEnd(8)) : C.red(`${server.successRate.toFixed(0)}%`.padEnd(8));
    const tools = String(server.tools).padEnd(5);
    const breaker = server.circuitBreaker === 'open' ? C.red('OPEN') : server.circuitBreaker === 'half_open' ? C.yellow('HALF') : C.green('CLOSED');

    stdout.write(`  │ ${C.white(name)}│ ${latency}│ ${success}│ ${C.cyan(tools)}│ ${breaker}     │\n`);
  }

  stdout.write(C.dim('  └──────────────────────────┴──────────┴──────────┴───────┴───────────┘\n'));
}

function renderAi(data: TuiData): void {
  const stdout = process.stdout;
  const ai = data.ai;

  stdout.write(C.bold.white('  🤖 ADAPTIVE AI ENGINE\n\n'));

  // Learning state
  const ls = ai.learningState;
  stdout.write(C.bold.cyan('  Self-Improvement State:\n'));
  stdout.write(`  Adaptive Threshold:  ${C.magenta(ls.adaptiveThreshold.toFixed(2))}\n`);
  stdout.write(`  True Positive Rate:  ${C.green(`${(ls.truePositiveRate * 100).toFixed(0)}%`)}\n`);
  stdout.write(`  False Positive Rate: ${ls.falsePositiveRate > 0.3 ? C.red(`${(ls.falsePositiveRate * 100).toFixed(0)}%`) : C.green(`${(ls.falsePositiveRate * 100).toFixed(0)}%`)}\n`);

  // Module weights
  stdout.write(C.dim(`\n  Module Weights:\n`));
  const modules = ls.moduleWeights || {};
  for (const [name, weight] of Object.entries(modules)) {
    const w = typeof weight === 'number' ? weight : parseFloat(weight as any);
    const bar = '█'.repeat(Math.round(w * 20)) + '░'.repeat(20 - Math.round(w * 20));
    stdout.write(`  ${C.cyan(name.padEnd(12))} ${bar} ${w.toFixed(2)}\n`);
  }

  // AI Suggestions
  stdout.write(C.bold.cyan(`\n  Active Suggestions (${ai.suggestions.length}):\n`));
  if (ai.suggestions.length === 0) {
    stdout.write(C.dim('    No suggestions yet — AI engine needs data to analyze.\n'));
  } else {
    for (const s of ai.suggestions.slice(0, 5)) {
      const conf = s.confidence || 0;
      const confColor = conf >= 0.85 ? C.green : conf >= 0.5 ? C.yellow : C.dim;
      stdout.write(`    ${confColor(`${(conf * 100).toFixed(0)}%`)} ${C.white(s.reason || s.id || 'Unknown')}\n`);
    }
  }

  // Threat intel
  stdout.write(C.bold.cyan(`\n  Threat Intelligence (${ai.threats.length} active):\n`));
  if (ai.threats.length === 0) {
    stdout.write(C.dim('    No active threats — feeds are clean.\n'));
  } else {
    for (const t of ai.threats.slice(0, 5)) {
      const sev = t.severity || t.entry?.severity;
      const sevColor = sev === 'CRITICAL' ? C.bgRed.white : sev === 'HIGH' ? C.red : C.yellow;
      stdout.write(`    ${sevColor(` ${sev || 'UNKNOWN'} `)} ${C.white(t.reason || t.entry?.description || 'Unknown threat')}\n`);
    }
  }

  // Baselines
  stdout.write(C.bold.cyan(`\n  Behavioral Baselines (${ai.baselines.length}):\n`));
  if (ai.baselines.length === 0) {
    stdout.write(C.dim('    No baselines learned yet.\n'));
  } else {
    for (const b of ai.baselines.slice(0, 5)) {
      stdout.write(`    ${C.white(b.toolName || b.tool)} on ${C.cyan(b.serverName || b.server)}: ${b.sampleCount} samples, avg ${Math.round(b.avgTokens || b.avg_tokens || 0)} tokens\n`);
    }
  }
}

function renderAudit(data: TuiData): void {
  const stdout = process.stdout;
  const a = data.audit;

  stdout.write(C.bold.white('  📋 AUDIT TRAIL\n\n'));
  stdout.write(`  Total Events:    ${C.white(a.total.toLocaleString())}\n`);
  stdout.write(`  Passed:          ${C.green(a.passed.toLocaleString())}\n`);
  stdout.write(`  Blocked:         ${a.blocked > 0 ? C.red(a.blocked.toLocaleString()) : C.green('0')}\n`);
  stdout.write(`  Flagged:         ${a.flagged > 0 ? C.yellow(a.flagged.toLocaleString()) : C.green('0')}\n`);

  stdout.write(C.dim(`\n  Recent Events:\n`));
  if (a.events.length === 0) {
    stdout.write(C.dim('    No audit events recorded yet.\n'));
  } else {
    for (const event of a.events.slice(0, 10)) {
      const time = (event.timestamp || '').slice(11, 19) || '--:--:--';
      const action = event.action === 'block' ? C.red('BLOCK') : event.action === 'flag' ? C.yellow('FLAG') : C.green('PASS');
      const server = (event.server_name || event.serverName || '').slice(0, 20).padEnd(20);
      const tool = (event.tool_name || event.toolName || '').slice(0, 15).padEnd(15);
      const rule = (event.rule_name || event.ruleName || '-').slice(0, 25);

      stdout.write(`    ${C.dim(time)} ${action} ${C.cyan(server)} ${C.white(tool)} ${C.dim(rule)}\n`);
    }
  }
}

function renderPolicy(data: TuiData): void {
  const stdout = process.stdout;
  const p = data.policy;

  stdout.write(C.bold.white('  📜 ACTIVE POLICY\n\n'));
  stdout.write(`  Mode:              ${p.mode === 'block' ? C.red('BLOCK') : p.mode === 'warn' ? C.yellow('WARN') : C.green('AUDIT')}\n`);
  stdout.write(`  Active Rules:      ${C.cyan(p.activeRules)}\n`);
  stdout.write(`  Auto-Generated:    ${C.magenta(p.autoGeneratedRules.length)}\n`);

  if (p.autoGeneratedRules.length > 0) {
    stdout.write(C.dim(`\n  AI-Generated Rules:\n`));
    for (const rule of p.autoGeneratedRules.slice(0, 10)) {
      stdout.write(`    ${C.magenta('✦')} ${rule}\n`);
    }
  }

  if (p.rules.length === 0) {
    stdout.write(C.dim('\n  No policy rules loaded. Start proxy with --policy to activate.\n'));
  }
}

function renderInstances(data: TuiData): void {
  const stdout = process.stdout;
  const instances = data.instances;

  stdout.write(C.bold.white('  🖥️  GUARDIAN INSTANCES\n\n'));
  stdout.write(`  Total Instances:   ${C.white(instances.length)}\n`);
  const active = instances.filter(i => i.status === 'active').length;
  const degraded = instances.filter(i => i.status === 'degraded').length;
  const offline = instances.filter(i => i.status === 'offline').length;

  stdout.write(`  Active:            ${C.green(active)}   Degraded: ${C.yellow(degraded)}   Offline: ${C.red(offline)}\n\n`);

  if (instances.length === 0) {
    stdout.write(C.dim('  No instances registered. Start mcp-guardian proxy to register.\n'));
    return;
  }

  // Table
  stdout.write(C.dim('  ┌──────────────────────┬──────────┬───────────┬──────────┬───────────┐\n'));
  stdout.write(C.dim('  │ Instance             │ Status   │ Requests  │ Blocked  │ Latency   │\n'));
  stdout.write(C.dim('  ├──────────────────────┼──────────┼───────────┼──────────┼───────────┤\n'));

  for (const inst of instances) {
    const name = inst.instanceId.slice(0, 20).padEnd(20);
    const status = inst.status === 'active' ? C.green('ACTIVE') : inst.status === 'degraded' ? C.yellow('DEGRADED') : C.red('OFFLINE');
    const requests = String(inst.totalRequests.toLocaleString()).padEnd(9);
    const blocked = inst.blockedRequests > 0 ? C.red(String(inst.blockedRequests).padEnd(8)) : C.dim('0'.padEnd(8));
    const latency = inst.avgLatencyMs ? `${inst.avgLatencyMs.toFixed(0)}ms`.padEnd(9) : 'N/A'.padEnd(9);

    stdout.write(`  │ ${C.white(name)}│ ${status}    │ ${C.cyan(requests)}│ ${blocked}│ ${C.dim(latency)}│\n`);
  }

  stdout.write(C.dim('  └──────────────────────┴──────────┴───────────┴──────────┴───────────┘\n'));
}