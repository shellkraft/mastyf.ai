/**
 * Abstracted database interface for MCP Guardian.
 * Supports SQLite (local/file) and PostgreSQL (cloud/horizontal scaling).
 */
import { ProxyCallRecord } from '../types.js';

export interface IDatabase {
  initialize(): Promise<void>;
  /** Returns null when no health data exists — no fabricated default. */
  getRecentSuccessRate(serverName: string): Promise<number | null>;
  addSecurityScan(serverName: string, score: number, cveCount: number, details: unknown): Promise<void>;
  getLatestSecurityScan(serverName: string): Promise<unknown | null>;
  getDistinctScannedServers(): Promise<string[]>;
  /** Union of servers seen in security_scans and call_records (for TUI/dashboard). */
  getDistinctActiveServers(): Promise<string[]>;
  addCostRecord(serverName: string, tokens: number, cost: number): Promise<void>;
  getTotalCost?(serverName?: string): Promise<number | null>;
  getLatestHealthCheck?(serverName: string): Promise<{ latency_ms?: number; tool_count?: number } | null>;
  addHealthCheck(serverName: string, latency: number, success: boolean, toolCount: number): Promise<void>;
  addCallRecord(record: ProxyCallRecord): Promise<void>;
  getCallRecordsForServer(serverName: string): Promise<ProxyCallRecord[]>;
  /** Execute callback within a database transaction. If the callback throws, the transaction is rolled back. */
  transaction<T>(fn: () => Promise<T> | T): Promise<T>;
  flush(): void | Promise<void>;
  close(): void | Promise<void>;
}