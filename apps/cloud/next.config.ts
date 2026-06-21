import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_PRO_CHECKOUT_URL } from './lib/pro-checkout-url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: repoRoot,
  serverExternalPackages: ['@mastyf-ai/server', 'better-sqlite3', 'pino'],
  env: {
    NEXT_PUBLIC_PRO_CHECKOUT_URL:
      process.env.NEXT_PUBLIC_PRO_CHECKOUT_URL ?? DEFAULT_PRO_CHECKOUT_URL,
  },
};

export default nextConfig;
