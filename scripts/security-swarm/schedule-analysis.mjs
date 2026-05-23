#!/usr/bin/env node
/**
 * Print cron / launchd snippets for weekly security analysis.
 * Usage: node scripts/security-swarm/schedule-analysis.mjs [--install-hint]
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const REPO = join(__dir, '..', '..');
const logPath = join(homedir(), '.mcp-guardian', 'scheduled-analysis.log');

if (process.env.GUARDIAN_CI_BYPASS_LICENSE !== 'true') {
  const gate = join(REPO, 'security-swarm', 'lib', 'require-pro-license.mjs');
  if (!existsSync(gate)) {
    console.error('[license] Missing security-swarm/lib/require-pro-license.mjs');
    process.exit(1);
  }
  const r = spawnSync(process.execPath, [gate, 'swarm'], { stdio: 'inherit', cwd: REPO, env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const cronLine = `0 9 * * 1 cd ${REPO} && pnpm security-swarm:analyze >> ${logPath} 2>&1`;

console.log('MCP Guardian — scheduled security analysis\n');
console.log('Cron (every Monday 09:00):');
console.log(cronLine);
console.log('\nmacOS launchd (save as ~/Library/LaunchAgents/com.mcp-guardian.analysis.plist):');
console.log(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.mcp-guardian.analysis</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>cd ${REPO} && pnpm security-swarm:analyze >> ${logPath} 2>&1</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>1</integer>
    <key>Hour</key><integer>9</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
</dict>
</plist>`);
console.log('\nLoad: launchctl load ~/Library/LaunchAgents/com.mcp-guardian.analysis.plist');
console.log(`Log: ${logPath}`);
