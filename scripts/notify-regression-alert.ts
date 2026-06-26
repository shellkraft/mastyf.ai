#!/usr/bin/env tsx
import { checkAndRespondToRegression } from '../src/alerting/incident-responder.js';

const [currentRaw, baselineRaw, deltaRaw] = process.argv.slice(2);
const currentRecall = Number(currentRaw);
const baselineRecall = Number(baselineRaw);
const delta = Number(deltaRaw);

if (!Number.isFinite(currentRecall) || !Number.isFinite(baselineRecall) || !Number.isFinite(delta)) {
  console.error('[notify-regression-alert] usage: tsx scripts/notify-regression-alert.ts <currentRecall> <baselineRecall> <delta>');
  process.exit(1);
}

await checkAndRespondToRegression(currentRecall, baselineRecall, delta);
console.log('[notify-regression-alert] incident notification dispatched (if webhooks configured)');
