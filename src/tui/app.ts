/**
 * MCP Guardian Interactive Polished CLI/TUI
 * 
 * A real-time terminal dashboard with AI-powered descriptive analysis
 * via local Ollama (qwen3:8b).
 */
import { DataFetcher, TuiData } from './data-fetcher.js';
import chalk from 'chalk';

const C = {
  dim: chalk.dim, bold: chalk.bold, green: chalk.green, red: chalk.red,
  yellow: chalk.yellow, cyan: chalk.cyan, magenta: chalk.magenta, white: chalk.white,
  gray: chalk.gray, blue: chalk.blue, bgRed: chalk.bgRed, bgGreen: chalk.bgGreen, bgYellow: chalk.bgYellow,
};

interface AppState { activeTab: number; running: boolean; frameCount: number; }

const TABS = ['Overview','Security','Cost','Health','AI Engine','Audit Trail','Policy','Instances'];

export async function startTui(dashboardUrl?: string): Promise<void> {
  const fetcher = new DataFetcher(dashboardUrl);
  const state: AppState = { activeTab: 0, running: true, frameCount: 0 };
  const stdout = process.stdout;
  const stdin = process.stdin;
  stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf-8');
  stdout.write('\x1B[?25l');

  stdin.on('data', (key: string) => {
    const code = key.charCodeAt(0);
    if (code === 3 || code === 27) state.running = false;
    else if (code === 9) state.activeTab = (state.activeTab + 1) % 8;
    else if (key >= '1' && key <= '8') state.activeTab = parseInt(key) - 1;
    else if (key === 'r') fetcher.fetchAll().catch(() => {});
  });

  fetcher.connectWebSocket();
  const pollInterval = fetcher.startPolling(3000);
  try { await fetcher.fetchAll(); } catch {}
  fetcher.onChange(() => render(state, fetcher.getData()));

  const renderInterval = setInterval(() => {
    if (!state.running) {
      clearInterval(renderInterval); clearInterval(pollInterval); fetcher.stop();
      stdout.write('\x1B[?25h'); stdout.write('\x1B[2J\x1B[H'); process.exit(0);
    }
    render(state, fetcher.getData());
    state.frameCount++;
  }, 1000 / 10);

  render(state, fetcher.getData());
  await new Promise<void>(r => { const c = setInterval(() => { if (!state.running) { clearInterval(c); r(); } }, 100); });
}

function render(state: AppState, data: TuiData | null): void {
  const stdout = process.stdout;
  const tw = stdout.columns || 120;
  stdout.write('\x1B[2J\x1B[H');

  stdout.write(C.bold.cyan('\u2554'+'\u2550'.repeat(86)+'\u2557\n'));
  stdout.write(C.bold.cyan('\u2551  MCP GUARDIAN \u2014 UNIFIED OBSERVABILITY PLATFORM                                   \u2551\n'));
  stdout.write(C.bold.magenta('\u2551  Adaptive AI-Driven Policy Engine | Real-Time Metrics | Multi-Instance Aggregation \u2551\n'));

  if (data) {
    const bar = C.dim(`  ${C.green(data.instances.length+' instances')} \u2502 ${C.red(data.overview.blockedRequests+' blocked')} \u2502 ${C.yellow('$'+data.overview.totalCostUsd.toFixed(4))} \u2502 ${C.cyan(data.overview.avgLatencyMs.toFixed(0)+'ms avg')} \u2502 Updated: ${data.overview.lastUpdated?.slice(11,19) || 'N/A'}`);
    stdout.write(bar + '\n');
  }

  stdout.write(C.dim('\u2500'.repeat(tw - 1)) + '\n');

  let tabBar = '';
  for (let i = 0; i < TABS.length; i++) {
    tabBar += (i === state.activeTab ? C.bgGreen.black(` ${i+1}. ${TABS[i]} `) : ` ${i+1}. ${TABS[i]}`) + '  ';
  }
  stdout.write('  ' + tabBar + '\n');
  stdout.write(C.dim('\u2500'.repeat(tw - 1)) + '\n\n');

  if (!data) {
    stdout.write(C.yellow('\n  Connecting... Reading history.db and AI state files.\n'));
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

  stdout.write('\n' + C.dim('\u2500'.repeat(tw - 1)) + '\n');
  stdout.write(C.dim('  1-8:Switch Tab  Tab:Next  r:Refresh  Esc:Quit     Frame: ' + state.frameCount + '\n'));
}

function wrapText(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).length > width) { lines.push(line); line = w; }
    else line = line ? line + ' ' + w : w;
  }
  if (line) lines.push(line);
  return lines;
}

function renderOverview(data: TuiData): void {
  const stdout = process.stdout;
  const o = data.overview;
  const score = data.security.overallScore;
  const sc = score >= 70 ? C.green : score >= 40 ? C.yellow : C.red;
  const bar = '\u2588'.repeat(Math.round(score/5)) + '\u2591'.repeat(20 - Math.round(score/5));

  stdout.write(C.bold.white('  EXECUTIVE SUMMARY\n\n'));
  stdout.write(`  Overall Security Score: ${sc(`${score}/100`)}  ${C.dim(`[${bar}]`)}\n`);
  stdout.write(`  Active Instances:      ${C.green(o.activeInstances)} / ${C.white(o.totalInstances)}\n`);
  stdout.write(`  Total Requests:        ${C.white(o.totalRequests.toLocaleString())}\n`);
  stdout.write(`  Blocked Requests:      ${o.blockedRequests > 0 ? C.red(o.blockedRequests.toLocaleString()) : C.green('0')}\n`);
  stdout.write(`  Pass Rate:             ${o.passRate > 90 ? C.green(`${o.passRate.toFixed(1)}%`) : C.yellow(`${o.passRate.toFixed(1)}%`)}\n`);
  stdout.write(`  Total Cost:            ${C.yellow(`$${o.totalCostUsd.toFixed(4)}`)}\n`);
  stdout.write(`  Burn Rate:             ${C.yellow(`$${o.burnRatePerHour.toFixed(4)}/hr`)}\n`);
  stdout.write(`  Avg Latency:           ${o.avgLatencyMs < 200 ? C.green(`${o.avgLatencyMs.toFixed(0)}ms`) : C.yellow(`${o.avgLatencyMs.toFixed(0)}ms`)}\n`);
  stdout.write(`  Active Servers:        ${C.cyan(o.activeServers)}\n`);

  // LLM Analysis prominently displayed
  if (data.ai.analysis) {
    stdout.write(C.bold.magenta('\n  LLM ANALYSIS:\n'));
    for (const line of wrapText(data.ai.analysis, 72)) {
      stdout.write(C.magenta(`  ${line}\n`));
    }
  }

  if (data.security.worstOffenders.length > 0) {
    stdout.write(C.bold.red('\n  TOP RISKS:\n'));
    for (const w of data.security.worstOffenders.slice(0, 5)) stdout.write(C.red(`     ${w}\n`));
  }

  if (data.cost.budgetAlerts.length > 0) {
    stdout.write(C.bold.red('\n  BUDGET ALERTS:\n'));
    for (const a of data.cost.budgetAlerts) stdout.write(C.red(`     ${a}\n`));
  }
}

function renderSecurity(data: TuiData): void {
  const stdout = process.stdout;
  const s = data.security;
  stdout.write(C.bold.white('  SECURITY POSTURE\n\n'));
  stdout.write(`  Overall Score:  ${s.overallScore >= 70 ? C.green(s.overallScore) : C.red(s.overallScore)}/100\n`);
  stdout.write(`  Active Threats: ${s.activeThreats > 0 ? C.red(s.activeThreats) : C.green('0')}\n`);
  stdout.write(`  Last Scan:      ${C.dim(s.lastScan)}\n\n`);
  if (s.servers.length === 0) { stdout.write(C.dim('  No security data.\n')); return; }

  stdout.write(C.dim('  \u250C'+'\u2500'.repeat(26)+'\u252C'+'\u2500'.repeat(9)+'\u252C'+'\u2500'.repeat(7)+'\u252C'+'\u2500'.repeat(10)+'\u252C'+'\u2500'.repeat(8)+'\u2510\n'));
  stdout.write(C.dim('  \u2502 Server                   \u2502 Score   \u2502 CVEs  \u2502 Critical \u2502 Auth   \u2502\n'));
  stdout.write(C.dim('  \u251C'+'\u2500'.repeat(26)+'\u253C'+'\u2500'.repeat(9)+'\u253C'+'\u2500'.repeat(7)+'\u253C'+'\u2500'.repeat(10)+'\u253C'+'\u2500'.repeat(8)+'\u2524\n'));
  for (const sv of s.servers) {
    const sc = sv.score >= 70 ? C.green : sv.score >= 40 ? C.yellow : C.red;
    stdout.write(`  \u2502 ${C.white(sv.name.slice(0,24).padEnd(24))}\u2502 ${sc(String(sv.score).padEnd(7))}\u2502 ${sv.cves > 0 ? C.red(String(sv.cves).padEnd(5)) : C.dim(String(sv.cves).padEnd(5))}\u2502 ${sv.critical > 0 ? C.bgRed.white(` ${sv.critical} `) : C.dim(' 0 ')}     \u2502 ${sv.auth ? C.green('\u2705') : C.red('\u274C')}   \u2502\n`);
  }
  stdout.write(C.dim('  \u2514'+'\u2500'.repeat(26)+'\u2534'+'\u2500'.repeat(9)+'\u2534'+'\u2500'.repeat(7)+'\u2534'+'\u2500'.repeat(10)+'\u2534'+'\u2500'.repeat(8)+'\u2518\n'));
}

function renderCost(data: TuiData): void {
  const stdout = process.stdout;
  const c = data.cost;
  stdout.write(C.bold.white('  COST ANALYSIS\n\n'));
  stdout.write(`  Total Cost:         ${C.yellow(`$${c.totalCost.toFixed(4)}`)}\n`);
  stdout.write(`  Projected Monthly:  ${C.yellow(`$${c.projectedMonthly.toFixed(2)}`)}\n`);
  stdout.write(`  Pricing Model:      ${C.cyan(c.pricingModel)}\n\n`);
  if (c.servers.length === 0) { stdout.write(C.dim('  No cost data.\n')); return; }
  stdout.write(C.dim('  \u250C'+'\u2500'.repeat(26)+'\u252C'+'\u2500'.repeat(12)+'\u252C'+'\u2500'.repeat(10)+'\u252C'+'\u2500'.repeat(9)+'\u2510\n'));
  stdout.write(C.dim('  \u2502 Server                   \u2502 Tokens     \u2502 Cost USD \u2502 Trend   \u2502\n'));
  stdout.write(C.dim('  \u251C'+'\u2500'.repeat(26)+'\u253C'+'\u2500'.repeat(12)+'\u253C'+'\u2500'.repeat(10)+'\u253C'+'\u2500'.repeat(9)+'\u2524\n'));
  for (const s of c.servers) {
    stdout.write(`  \u2502 ${C.white(s.name.slice(0,24).padEnd(24))}\u2502 ${C.cyan(String(s.tokens.toLocaleString()).padEnd(10))}\u2502 ${C.yellow(('$'+s.cost.toFixed(4)).padEnd(8))}\u2502 ${s.trend==='increasing'?'\u{1F4C8}':'\u27A1\uFE0F'}     \u2502\n`);
  }
  stdout.write(C.dim('  \u2514'+'\u2500'.repeat(26)+'\u2534'+'\u2500'.repeat(12)+'\u2534'+'\u2500'.repeat(10)+'\u2534'+'\u2500'.repeat(9)+'\u2518\n'));
}

function renderHealth(data: TuiData): void {
  const stdout = process.stdout;
  const h = data.health;
  stdout.write(C.bold.white('  HEALTH STATUS\n\n'));
  stdout.write(`  Avg Latency:  ${h.avgLatency < 200 ? C.green(`${h.avgLatency}ms`) : C.yellow(`${h.avgLatency}ms`)}\n`);
  stdout.write(`  Total Tools:  ${C.cyan(h.totalTools)}\n`);
  stdout.write(`  At Risk:      ${h.atRisk.length > 0 ? C.red(h.atRisk.join(', ')) : C.green('None')}\n\n`);
  if (h.servers.length === 0) { stdout.write(C.dim('  No health data.\n')); return; }
  stdout.write(C.dim('  \u250C'+'\u2500'.repeat(26)+'\u252C'+'\u2500'.repeat(10)+'\u252C'+'\u2500'.repeat(10)+'\u252C'+'\u2500'.repeat(7)+'\u252C'+'\u2500'.repeat(11)+'\u2510\n'));
  stdout.write(C.dim('  \u2502 Server                   \u2502 Latency  \u2502 Success  \u2502 Tools \u2502 Breaker   \u2502\n'));
  stdout.write(C.dim('  \u251C'+'\u2500'.repeat(26)+'\u253C'+'\u2500'.repeat(10)+'\u253C'+'\u2500'.repeat(10)+'\u253C'+'\u2500'.repeat(7)+'\u253C'+'\u2500'.repeat(11)+'\u2524\n'));
  for (const s of h.servers) {
    const lat = s.latency < 200 ? C.green(`${s.latency}ms`.padEnd(8)) : C.yellow(`${s.latency}ms`.padEnd(8));
    const suc = s.successRate > 90 ? C.green(`${s.successRate.toFixed(0)}%`.padEnd(8)) : C.red(`${s.successRate.toFixed(0)}%`.padEnd(8));
    stdout.write(`  \u2502 ${C.white(s.name.slice(0,24).padEnd(24))}\u2502 ${lat}\u2502 ${suc}\u2502 ${C.cyan(String(s.tools).padEnd(5))}\u2502 ${s.circuitBreaker==='open'?C.red('OPEN'):C.green('CLOSED')}     \u2502\n`);
  }
  stdout.write(C.dim('  \u2514'+'\u2500'.repeat(26)+'\u2534'+'\u2500'.repeat(10)+'\u2534'+'\u2500'.repeat(10)+'\u2534'+'\u2500'.repeat(7)+'\u2534'+'\u2500'.repeat(11)+'\u2518\n'));
}

function renderAi(data: TuiData): void {
  const stdout = process.stdout;
  const ai = data.ai;
  stdout.write(C.bold.white('  ADAPTIVE AI ENGINE\n\n'));

  // LLM Analysis first for immediate insight
  if (ai.analysis) {
    stdout.write(C.bold.magenta('  LLM ANALYSIS:\n'));
    for (const line of wrapText(ai.analysis, 72)) {
      stdout.write(C.magenta(`  ${line}\n`));
    }
    stdout.write('\n');
  } else {
    stdout.write(C.dim('  LLM analysis pending \u2014 ensure Ollama is running with qwen3:8b\n\n'));
  }

  const ls = ai.learningState;
  stdout.write(C.bold.cyan('  Self-Improvement State:\n'));
  stdout.write(`  Adaptive Threshold:  ${C.magenta(ls.adaptiveThreshold.toFixed(2))}\n`);
  stdout.write(`  True Positive Rate:  ${C.green(`${(ls.truePositiveRate * 100).toFixed(0)}%`)}\n`);
  stdout.write(`  False Positive Rate: ${ls.falsePositiveRate > 0.3 ? C.red(`${(ls.falsePositiveRate * 100).toFixed(0)}%`) : C.green(`${(ls.falsePositiveRate * 100).toFixed(0)}%`)}\n`);

  stdout.write(C.dim('\n  Module Weights:\n'));
  const modules = ls.moduleWeights || {};
  for (const [name, weight] of Object.entries(modules)) {
    const w = typeof weight === 'number' ? weight : parseFloat(weight as any);
    const bar = '\u2588'.repeat(Math.round(w * 20)) + '\u2591'.repeat(20 - Math.round(w * 20));
    stdout.write(`  ${C.cyan(name.padEnd(12))} ${bar} ${w.toFixed(2)}\n`);
  }

  stdout.write(C.bold.cyan(`\n  Active Suggestions (${ai.suggestions.length}):\n`));
  if (ai.suggestions.length === 0) stdout.write(C.dim('    No suggestions yet.\n'));
  else for (const s of ai.suggestions.slice(0, 5)) {
    const conf = s.confidence || 0;
    const cc = conf >= 0.85 ? C.green : conf >= 0.5 ? C.yellow : C.dim;
    stdout.write(`    ${cc(`${(conf * 100).toFixed(0)}%`)} ${C.white(s.ruleName || s.id || 'Unknown')}\n`);
  }

  stdout.write(C.bold.cyan(`\n  Threat Intelligence (${ai.threats.length} active):\n`));
  if (ai.threats.length === 0) stdout.write(C.dim('    No active threats.\n'));
  else for (const t of ai.threats.slice(0, 5)) {
    stdout.write(`    ${C.bgRed.white(` ${t.severity || 'N/A'} `)} ${C.white(t.id)} (${C.cyan(t.source)})\n`);
  }
}

function renderAudit(data: TuiData): void {
  const stdout = process.stdout;
  const a = data.audit;
  stdout.write(C.bold.white('  AUDIT TRAIL\n\n'));
  stdout.write(`  Total Events:    ${C.white(a.total.toLocaleString())}\n`);
  stdout.write(`  Passed:          ${C.green(a.passed.toLocaleString())}\n`);
  stdout.write(`  Blocked:         ${a.blocked > 0 ? C.red(a.blocked.toLocaleString()) : C.green('0')}\n`);
  stdout.write(`  Flagged:         ${a.flagged > 0 ? C.yellow(a.flagged.toLocaleString()) : C.green('0')}\n`);
  stdout.write(C.dim('\n  Recent Events:\n'));
  if (a.events.length === 0) { stdout.write(C.dim('    No events.\n')); return; }
  for (const e of a.events.slice(0, 10)) {
    const time = (e.timestamp || '').slice(11, 19) || '--:--:--';
    const act = e.action === 'block' ? C.red('BLOCK') : e.action === 'flag' ? C.yellow('FLAG') : C.green('PASS');
    stdout.write(`    ${C.dim(time)} ${act} ${C.cyan((e.server_name||'').slice(0,20).padEnd(20))} ${C.white((e.tool_name||'').slice(0,15).padEnd(15))}\n`);
  }
}

function renderPolicy(data: TuiData): void {
  const stdout = process.stdout;
  const p = data.policy;
  stdout.write(C.bold.white('  ACTIVE POLICY\n\n'));
  stdout.write(`  Mode:              ${p.mode === 'block' ? C.red('BLOCK') : p.mode === 'warn' ? C.yellow('WARN') : C.green('AUDIT')}\n`);
  stdout.write(`  Active Rules:      ${C.cyan(p.activeRules)}\n`);
  if (p.autoGeneratedRules.length > 0) for (const r of p.autoGeneratedRules.slice(0,10)) stdout.write(`    ${C.magenta('\u2726')} ${r}\n`);
  if (p.rules.length === 0) stdout.write(C.dim('\n  No policy rules loaded.\n'));
}

function renderInstances(data: TuiData): void {
  const stdout = process.stdout;
  const inst = data.instances;
  const active = inst.filter(i => i.status === 'active').length;
  const degraded = inst.filter(i => i.status === 'degraded').length;
  const offline = inst.filter(i => i.status === 'offline').length;
  stdout.write(C.bold.white('  GUARDIAN INSTANCES\n\n'));
  stdout.write(`  Total: ${C.white(inst.length)}   Active: ${C.green(active)}   Degraded: ${C.yellow(degraded)}   Offline: ${C.red(offline)}\n\n`);
  if (inst.length === 0) { stdout.write(C.dim('  No instances.\n')); return; }
  stdout.write(C.dim('  \u250C'+'\u2500'.repeat(22)+'\u252C'+'\u2500'.repeat(10)+'\u252C'+'\u2500'.repeat(11)+'\u252C'+'\u2500'.repeat(10)+'\u252C'+'\u2500'.repeat(11)+'\u2510\n'));
  stdout.write(C.dim('  \u2502 Instance              \u2502 Status   \u2502 Requests  \u2502 Blocked  \u2502 Latency   \u2502\n'));
  stdout.write(C.dim('  \u251C'+'\u2500'.repeat(22)+'\u253C'+'\u2500'.repeat(10)+'\u253C'+'\u2500'.repeat(11)+'\u253C'+'\u2500'.repeat(10)+'\u253C'+'\u2500'.repeat(11)+'\u2524\n'));
  for (const i of inst) {
    const st = i.status === 'active' ? C.green('ACTIVE') : i.status === 'degraded' ? C.yellow('DEGRADED') : C.red('OFFLINE');
    stdout.write(`  \u2502 ${C.white(i.instanceId.slice(0,20).padEnd(20))}\u2502 ${st}    \u2502 ${C.cyan(String(i.totalRequests.toLocaleString()).padEnd(9))}\u2502 ${i.blockedRequests > 0 ? C.red(String(i.blockedRequests).padEnd(8)) : C.dim('0'.padEnd(8))}\u2502 ${C.dim((i.avgLatencyMs ? `${i.avgLatencyMs.toFixed(0)}ms` : 'N/A').padEnd(9))}\u2502\n`);
  }
  stdout.write(C.dim('  \u2514'+'\u2500'.repeat(22)+'\u2534'+'\u2500'.repeat(10)+'\u2534'+'\u2500'.repeat(11)+'\u2534'+'\u2500'.repeat(10)+'\u2534'+'\u2500'.repeat(11)+'\u2518\n'));
}