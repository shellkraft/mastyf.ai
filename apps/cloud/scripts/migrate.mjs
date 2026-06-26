#!/usr/bin/env node
/**
 * Apply SQL migrations for the cloud control plane database.
 * Usage: DATABASE_URL=postgresql://... node scripts/migrate.mjs
 *
 * Rollback: apply matching `*.down.sql` manually, then DELETE FROM _cloud_migrations WHERE name = '...';
 */
import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '../db/migrations');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  await sql`
    CREATE TABLE IF NOT EXISTS _cloud_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const applied = new Set(
    (await sql`SELECT name FROM _cloud_migrations`).map((r) => r.name),
  );

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`skip ${file}`);
      continue;
    }
    const body = readFileSync(join(migrationsDir, file), 'utf8');
    await sql.unsafe(body);
    await sql`INSERT INTO _cloud_migrations (name) VALUES (${file})`;
    console.log(`applied ${file}`);
  }

  console.log('migrations complete');
} finally {
  await sql.end();
}
