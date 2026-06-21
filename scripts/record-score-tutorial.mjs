#!/usr/bin/env node
/**
 * Record a short WebM walkthrough: lookup MCP package → view score → badge API.
 *
 * Usage:
 *   BASE_URL=http://localhost:3001 node scripts/record-score-tutorial.mjs
 *   BASE_URL=https://mastyf-ai-cloud.vercel.app node scripts/record-score-tutorial.mjs
 *
 * Requires: npx playwright (chromium) — installed on first run.
 */
import { mkdirSync, existsSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'docs/tutorials/videos');
const BASE_URL = (process.env.BASE_URL || 'https://mastyf-ai-cloud-jet.vercel.app').replace(/\/$/, '');
const PACKAGE = process.env.TUTORIAL_PACKAGE || '@playwright/mcp';
const ENCODED_PKG = encodeURIComponent(PACKAGE);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const probe = spawnSync('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', `${BASE_URL}/certified`], {
    encoding: 'utf-8',
  });
  const code = probe.stdout?.trim();
  if (code !== '200') {
    console.error(`ERROR: ${BASE_URL}/certified returned HTTP ${code || 'failed'}`);
    console.error('Start the cloud app: pnpm cloud:dev');
    console.error('Or set BASE_URL to your deployed Vercel URL once live.');
    process.exit(1);
  }

  console.log(`Recording tutorial against ${BASE_URL} …`);

  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    await page.goto(`${BASE_URL}/certified`, { waitUntil: 'domcontentloaded' });
    await sleep(2000);

    // Step cards on /certified
    await page.locator('text=Look up').first().scrollIntoViewIfNeeded().catch(() => {});
    await sleep(1200);

    const input = page.locator('#badge-pkg');
    await input.waitFor({ state: 'visible' });
    await input.fill(PACKAGE);
    await sleep(1500);

    const preview = page.locator('.socket-search-preview img');
    if (await preview.count()) {
      await preview.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    }
    await sleep(1500);

    const viewScore = page.getByRole('link', { name: 'View score' });
    if (await viewScore.isEnabled()) {
      await viewScore.click();
      await page.waitForURL(/\/certified\//, { timeout: 20000 });
      await sleep(2500);
      await page.evaluate(() => window.scrollBy(0, 350));
      await sleep(1500);
    }

    await page.goto(`${BASE_URL}/api/v1/badge/${ENCODED_PKG}/json`, { waitUntil: 'domcontentloaded' });
    await sleep(2500);
  } catch (err) {
    console.warn('Recording continued with partial flow:', err instanceof Error ? err.message : err);
  }

  const video = page.video();
  await page.close();
  await context.close();
  await browser.close();

  if (video) {
    const rawPath = await video.path();
    const destName =
      BASE_URL.includes('mastyf-ai-cloud-jet') ? 'live-security-score-demo-jet.webm' : 'live-security-score-demo.webm';
    const dest = join(OUT_DIR, destName);
    if (existsSync(rawPath)) {
      renameSync(rawPath, dest);
      console.log(`Saved: ${dest}`);
    }
  } else {
    console.log(`Check ${OUT_DIR} for recorded WebM`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
