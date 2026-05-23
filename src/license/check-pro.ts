#!/usr/bin/env node
/**
 * CLI: verify Pro license for a feature (used by security-swarm scripts).
 * Usage: node dist/license/check-pro.js swarm
 */
import { runCheckProCli } from './enforce-pro.js';

const code = await runCheckProCli(process.argv.slice(2));
process.exit(code);
