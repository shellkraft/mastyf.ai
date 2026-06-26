import { defineConfig } from 'vitest/config';
import { workspacePackageAliases } from './vitest.workspace-aliases';

/** Adversarial harness Node tests — run via `pnpm harness:node`, not default `pnpm test`. */
export default defineConfig({
  resolve: {
    alias: workspacePackageAliases,
  },
  test: {
    setupFiles: ['./tests/setup-env.ts'],
    include: ['adversarial-harness/node/**/*.{test,spec}.mjs'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    maxConcurrency: 1,
    fileParallelism: false,
    testTimeout: 120_000,
    hookTimeout: 120_000,
    teardownTimeout: 60_000,
  },
});
