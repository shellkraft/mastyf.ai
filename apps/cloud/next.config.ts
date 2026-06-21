import type { NextConfig } from 'next';
import path from 'path';
import { fileURLToPath } from 'url';

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    '/api/**/*': ['./dist/**/*'],
    '/certified/**/*': ['./dist/**/*'],
  },
  serverExternalPackages: ['better-sqlite3', 'pino'],
};

export default nextConfig;
