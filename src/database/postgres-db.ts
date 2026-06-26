/**
 * PostgreSQL implementation of IDatabase for horizontal scaling.
 * Uses connection pool for production workloads.
 * Enable with: DB_TYPE=postgres DATABASE_URL=postgresql://user:pass@host:5432/db
 */
import { ProxyCallRecord } from '../types.js';
import { IDatabase } from './database-interface.js';
import { Logger } from '../utils/logger.js';
import { loadPg, type PgPoolType } from './pg-loader.js';
import { runMigrations } from './migration-runner.js';
import { isPostgresRlsEnabled, withPostgresTenantSession } from './postgres-tenant-session.js';
import {
  decryptAuditArgsField,
  decryptField,
  encryptAuditArgsField,
  encryptField,
} from '../utils/field-encryption.js';

export class PostgresDatabase implements IDatabase {
  private pool!: PgPoolType;
  private initialized = false;
  private connectionString: string;

  constructor() {
    this.connectionString = process.env['DATABASE_URL'] || 'postgresql://localhost:5432/mastyf_ai';
  }

  /** Run query under Postgres RLS session when enabled and tenantId is set. */
  private async tenantQuery(
    tenantId: string | undefined,
    sql: string,
    params: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }> {
    if (isPostgresRlsEnabled() && tenantId) {
      return withPostgresTenantSession(this.pool, tenantId, (client) =>
        client.query(sql, params),
      ) as Promise<{ rows: Record<string, unknown>[] }>;
    }
    return this.pool.query(sql, params) as Promise<{ rows: Record<string, unknown>[] }>;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const { Pool } = await loadPg();
    const poolMax = parseInt(process.env['MASTYF_AI_PG_POOL_MAX'] ?? '10', 10);
    this.pool = new Pool({
      connectionString: this.connectionString,
      max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 10,
      idleTimeoutMillis: 30000,
    });

    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS security_scans (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          server_name TEXT NOT NULL,
          score INTEGER NOT NULL,
          cve_count INTEGER NOT NULL DEFAULT 0,
          details JSONB
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS cost_records (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          server_name TEXT NOT NULL,
          tokens_used INTEGER NOT NULL,
          cost_usd REAL NOT NULL
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS health_checks (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          server_name TEXT NOT NULL,
          latency_ms INTEGER NOT NULL,
          success INTEGER NOT NULL,
          tool_count INTEGER NOT NULL
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS call_records (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMPTZ DEFAULT NOW(),
          server_name TEXT NOT NULL,
          tool_name TEXT NOT NULL,
          request_tokens INTEGER NOT NULL DEFAULT 0,
          response_tokens INTEGER NOT NULL DEFAULT 0,
          total_tokens INTEGER NOT NULL DEFAULT 0,
          duration_ms INTEGER NOT NULL DEFAULT 0
        )
      `);
      await client.query('CREATE INDEX IF NOT EXISTS idx_security_server ON security_scans(server_name)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_cost_server ON cost_records(server_name)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_health_server ON health_checks(server_name)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_call_server ON call_records(server_name)');
      await client.query('ALTER TABLE call_records ADD COLUMN IF NOT EXISTS blocked BOOLEAN NOT NULL DEFAULT false');
      await client.query('ALTER TABLE call_records ADD COLUMN IF NOT EXISTS block_rule TEXT');
      await client.query('ALTER TABLE call_records ADD COLUMN IF NOT EXISTS block_reason TEXT');
      await client.query('ALTER TABLE call_records ADD COLUMN IF NOT EXISTS model TEXT');
      await client.query('ALTER TABLE call_records ADD COLUMN IF NOT EXISTS cost_usd REAL');
      await client.query('ALTER TABLE call_records ADD COLUMN IF NOT EXISTS pricing_source TEXT');
      await client.query('ALTER TABLE call_records ADD COLUMN IF NOT EXISTS token_source TEXT');
      await client.query('ALTER TABLE call_records ADD COLUMN IF NOT EXISTS argument_snippet TEXT');

      await runMigrations(this.pool);

      this.initialized = true;
      Logger.info('PostgreSQL database initialized');
    } finally {
      client.release();
    }
  }

  async getRecentSuccessRate(serverName: string, tenantId?: string): Promise<number | null> {
    const result = tenantId
      ? await this.tenantQuery(
        tenantId,
        `SELECT AVG(success) as avg FROM (
           SELECT success FROM health_checks
           WHERE server_name = $1 AND tenant_id = $2
           ORDER BY timestamp DESC
           LIMIT 10
         ) AS recent`,
        [serverName, tenantId],
      )
      : await this.pool.query(
        `SELECT AVG(success) as avg FROM (
           SELECT success FROM health_checks
           WHERE server_name = $1
           ORDER BY timestamp DESC
           LIMIT 10
         ) AS recent`,
        [serverName],
      );
    if (result.rows.length > 0 && result.rows[0].avg !== null) {
      return Number(result.rows[0].avg);
    }
    return null;
  }

  async addSecurityScan(
    serverName: string,
    score: number,
    cveCount: number,
    details: unknown,
    tenantId = 'default',
  ): Promise<void> {
    await this.tenantQuery(
      tenantId,
      'INSERT INTO security_scans (server_name, score, cve_count, details, tenant_id) VALUES ($1, $2, $3, $4, $5)',
      [serverName, score, cveCount, JSON.stringify(details), tenantId],
    );
  }

  async getLatestSecurityScan(serverName: string, tenantId?: string): Promise<unknown | null> {
    const result = tenantId
      ? await this.tenantQuery(
        tenantId,
        'SELECT * FROM security_scans WHERE server_name = $1 AND tenant_id = $2 ORDER BY id DESC LIMIT 1',
        [serverName, tenantId],
      )
      : await this.pool.query(
        'SELECT * FROM security_scans WHERE server_name = $1 ORDER BY id DESC LIMIT 1',
        [serverName],
      );
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async getDistinctScannedServers(tenantId?: string): Promise<string[]> {
    const result = tenantId
      ? await this.tenantQuery(
        tenantId,
        'SELECT DISTINCT server_name FROM security_scans WHERE tenant_id = $1 ORDER BY server_name',
        [tenantId],
      )
      : await this.pool.query(
        'SELECT DISTINCT server_name FROM security_scans ORDER BY server_name',
      );
    return result.rows.map((r) => String((r as { server_name: string }).server_name));
  }

  async getDistinctActiveServers(tenantId?: string): Promise<string[]> {
    const result = tenantId
      ? await this.tenantQuery(
        tenantId,
        `SELECT DISTINCT server_name FROM (
           SELECT server_name FROM security_scans WHERE tenant_id = $1
           UNION
           SELECT server_name FROM call_records WHERE tenant_id = $1
         ) AS active ORDER BY server_name`,
        [tenantId, tenantId],
      )
      : await this.pool.query(
        `SELECT DISTINCT server_name FROM (
           SELECT server_name FROM security_scans
           UNION
           SELECT server_name FROM call_records
         ) AS active ORDER BY server_name`,
      );
    return result.rows.map((r) => String((r as { server_name: string }).server_name));
  }

  async addCostRecord(
    serverName: string,
    tokens: number,
    cost: number,
    tenantId = 'default',
  ): Promise<void> {
    await this.tenantQuery(
      tenantId,
      'INSERT INTO cost_records (server_name, tokens_used, cost_usd, tenant_id) VALUES ($1, $2, $3, $4)',
      [serverName, tokens, cost, tenantId],
    );
  }

  async addHealthCheck(
    serverName: string,
    latency: number,
    success: boolean,
    toolCount: number,
    tenantId = 'default',
  ): Promise<void> {
    await this.tenantQuery(
      tenantId,
      'INSERT INTO health_checks (server_name, latency_ms, success, tool_count, tenant_id) VALUES ($1, $2, $3, $4, $5)',
      [serverName, latency, success ? 1 : 0, toolCount, tenantId],
    );
  }

  async addCallRecord(record: ProxyCallRecord): Promise<void> {
    const tid = record.tenantId ?? 'default';
    await this.tenantQuery(
      tid,
      'INSERT INTO call_records (server_name, tool_name, request_tokens, response_tokens, total_tokens, duration_ms, blocked, block_rule, block_reason, argument_snippet, model, cost_usd, pricing_source, token_source, tenant_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)',
      [
        record.serverName,
        record.toolName,
        record.requestTokens,
        record.responseTokens,
        record.totalTokens,
        record.durationMs,
        Boolean(record.blocked),
        record.blockRule ?? null,
        encryptField(record.blockReason ?? null),
        encryptAuditArgsField(record.argumentSnippet ?? null),
        record.model ?? null,
        record.costUsd ?? null,
        record.pricingSource ?? null,
        record.tokenSource ?? null,
        tid,
      ],
    );
  }

  async getCallRecordsForServer(
    serverName: string,
    _limit?: number,
    tenantId?: string,
  ): Promise<ProxyCallRecord[]> {
    const result = tenantId
      ? await this.tenantQuery(
        tenantId,
        'SELECT server_name, tool_name, request_tokens, response_tokens, total_tokens, duration_ms, timestamp::text, blocked, block_rule, block_reason, model, cost_usd, pricing_source, token_source, tenant_id FROM call_records WHERE server_name = $1 AND tenant_id = $2',
        [serverName, tenantId],
      )
      : await this.pool.query(
        'SELECT server_name, tool_name, request_tokens, response_tokens, total_tokens, duration_ms, timestamp::text, blocked, block_rule, block_reason, model, cost_usd, pricing_source, token_source, tenant_id FROM call_records WHERE server_name = $1',
        [serverName],
      );
    return result.rows.map((row: any) => ({
      serverName: row.server_name,
      toolName: row.tool_name,
      requestTokens: row.request_tokens,
      responseTokens: row.response_tokens,
      totalTokens: row.total_tokens,
      durationMs: row.duration_ms,
      timestamp: row.timestamp,
      model: row.model ?? undefined,
      costUsd: row.cost_usd != null ? Number(row.cost_usd) : undefined,
      pricingSource: row.pricing_source ?? undefined,
      blocked: Boolean(row.blocked),
      blockRule: row.block_rule ?? undefined,
      blockReason: decryptField(row.block_reason ?? null) ?? undefined,
      tokenSource: row.token_source === 'api' || row.token_source === 'estimated'
        ? row.token_source
        : undefined,
      tenantId: row.tenant_id ?? 'default',
    }));
  }

  async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
    const result = fn();
    if (!(result instanceof Promise)) {
      return result;
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const asyncResult = await result;
      await client.query('COMMIT');
      return asyncResult;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** @deprecated Use transaction(fn: () => Promise<T>) — pool client is internal. */
  async withTransactionClient<T>(fn: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async flush(): Promise<void> {
    // PostgreSQL auto-commits — no flush needed
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.initialized = false;
    }
  }
}