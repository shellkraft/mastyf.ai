import { defineConfig } from 'vitest/config';
import path from 'path';

/** Integration tests (MCP subprocesses, HTTP fixtures) — excluded from default `pnpm test`. */
export default defineConfig({
  resolve: {
    alias: {
      '@mastyff-ai/plugin-sdk': path.resolve(__dirname, 'packages/plugin-sdk/dist/index.js'),
    },
  },
  test: {
    setupFiles: ['./tests/setup-env.ts'],
    include: ['tests/integration/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    maxConcurrency: 1,
    testTimeout: 120_000,
  },
});
