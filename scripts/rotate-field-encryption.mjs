#!/usr/bin/env node
import Database from 'better-sqlite3';
import os from 'node:os';
import path from 'node:path';
import { encryptField, decryptField, getFieldEncryptionStatus } from '../dist/utils/field-encryption.js';

const dbPath = process.env.MASTYFF_AI_DB_PATH || path.join(os.homedir(), '.mastyff-ai', 'history.db');
const dryRun = process.argv.includes('--dry-run');
const status = getFieldEncryptionStatus();

if (!status.enabled) {
  console.log('[rotate-field-encryption] encryption not enabled; nothing to rotate');
  process.exit(0);
}

if (!status.rotationEnabled) {
  console.log('[rotate-field-encryption] rotation disabled; set MASTYFF_AI_DB_ENCRYPTION_ROTATION_ENABLED=true');
  process.exit(0);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const rows = db.prepare(`
  SELECT id, block_reason as blockReason
  FROM call_records
  WHERE block_reason IS NOT NULL
`).all();

let updated = 0;
const updateStmt = db.prepare('UPDATE call_records SET block_reason = ? WHERE id = ?');

for (const row of rows) {
  const plain = decryptField(row.blockReason);
  const reEncrypted = encryptField(plain);
  if (reEncrypted && reEncrypted !== row.blockReason) {
    updated += 1;
    if (!dryRun) updateStmt.run(reEncrypted, row.id);
  }
}

db.close();
console.log(`[rotate-field-encryption] active key version: ${status.activeVersion}`);
console.log(`[rotate-field-encryption] scanned rows: ${rows.length}`);
console.log(`[rotate-field-encryption] ${dryRun ? 'would update' : 'updated'} rows: ${updated}`);
