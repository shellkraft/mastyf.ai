import { defineConfig } from 'vitest/config';
import { workspacePackageAliases } from './vitest.workspace-aliases';

/** Integration tests (MCP subprocesses, HTTP fixtures) — excluded from default `pnpm test`. */
export default defineConfig({
  resolve: {
    alias: workspacePackageAliases,
  },
  test: {
    setupFiles: ['./tests/setup-env.ts'],
    include: ['tests/integration/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    maxConcurrency: 1,
    testTimeout: 120_000,
  },
});
