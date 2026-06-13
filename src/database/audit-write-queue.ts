/**
 * Async audit write queue — decouples SQLite writes from the JSON-RPC hot path.
 * Single-writer discipline: one consumer drains batches via setImmediate.
 */
import type { IDatabase } from './database-interface.js';
import type { ProxyCallRecord } from '../types.js';
import { Logger } from '../utils/logger.js';
import { StructuredLogger } from '../utils/structured-logger.js';
import { onShutdown } from '../utils/shutdown.js';

export interface AuditWriteJob {
  record: ProxyCallRecord;
  costRecord?: { serverName: string; tokens: number; costUsd: number; tenantId: string };
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const MAX_QUEUE = envInt('MASTYFF_AI_AUDIT_QUEUE_MAX', 5000);
const BATCH_SIZE = envInt('MASTYFF_AI_AUDIT_QUEUE_BATCH', 32);

let queue: AuditWriteJob[] = [];
let draining = false;
let db: IDatabase | null = null;
let droppedWrites = 0;
let registeredShutdown = false;

export function getAuditQueueDepth(): number {
  return queue.length;
}

export function getAuditDroppedWrites(): number {
  return droppedWrites;
}

export function initAuditWriteQueue(database: IDatabase): void {
  db = database;
  if (!registeredShutdown) {
    registeredShutdown = true;
    onShutdown(async () => {
      await flushAuditWriteQueue();
    });
  }
}

export function enqueueAuditWrite(job: AuditWriteJob): boolean {
  if (!db) {
    Logger.warn('[audit-queue] enqueue before init — dropping write');
    droppedWrites++;
    return false;
  }
  if (queue.length >= MAX_QUEUE) {
    droppedWrites++;
    StructuredLogger.info({
      event: 'audit_queue_overflow',
      queueDepth: queue.length,
      maxQueue: MAX_QUEUE,
      droppedTotal: droppedWrites,
      serverName: job.record.serverName,
    });
    return false;
  }
  queue.push(job);
  scheduleDrain();
  return true;
}

function scheduleDrain(): void {
  if (draining) return;
  draining = true;
  setImmediate(() => {
    void drainBatch().finally(() => {
      draining = false;
      if (queue.length > 0) scheduleDrain();
    });
  });
}

async function drainBatch(): Promise<void> {
  if (!db || queue.length === 0) return;

  const batch = queue.splice(0, Math.min(BATCH_SIZE, queue.length));
  for (const job of batch) {
    try {
      await db.addCallRecord(job.record);
      if (job.costRecord && job.costRecord.costUsd > 0) {
        const { serverName, tokens, costUsd, tenantId } = job.costRecord;
        await db.addCostRecord(serverName, tokens, costUsd, tenantId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      Logger.warn(`[audit-queue] write failed: ${message}`);
    }
  }
}

export async function flushAuditWriteQueue(): Promise<void> {
  while (queue.length > 0) {
    await drainBatch();
  }
}

/** Reset for tests. */
export function resetAuditWriteQueueForTests(): void {
  queue = [];
  draining = false;
  db = null;
  droppedWrites = 0;
  registeredShutdown = false;
}
