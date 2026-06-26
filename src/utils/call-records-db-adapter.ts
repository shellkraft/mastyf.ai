/**
 * Minimal IDatabase adapter backed by in-memory call records (federated reads).
 */
import type { IDatabase } from '../database/database-interface.js';
import type { ProxyCallRecord } from '../types.js';

export class CallRecordsDbAdapter implements IDatabase {
  private records: ProxyCallRecord[];

  constructor(records: ProxyCallRecord[]) {
    this.records = records;
  }

  async initialize(): Promise<void> {}

  async getRecentSuccessRate(): Promise<number | null> {
    return null;
  }

  async addSecurityScan(): Promise<void> {
    throw new Error('CallRecordsDbAdapter is read-only');
  }

  async getLatestSecurityScan(): Promise<unknown | null> {
    return null;
  }

  async getDistinctScannedServers(tenantId?: string): Promise<string[]> {
    return this.distinctServers(tenantId);
  }

  async getDistinctActiveServers(tenantId?: string): Promise<string[]> {
    return this.distinctServers(tenantId);
  }

  private distinctServers(tenantId?: string): string[] {
    const recs = tenantId
      ? this.records.filter((r) => (r.tenantId || 'default') === tenantId)
      : this.records;
    return [...new Set(recs.map((r) => r.serverName).filter(Boolean))];
  }

  async addCostRecord(): Promise<void> {
    throw new Error('CallRecordsDbAdapter is read-only');
  }

  async addHealthCheck(): Promise<void> {
    throw new Error('CallRecordsDbAdapter is read-only');
  }

  async addCallRecord(): Promise<void> {
    throw new Error('CallRecordsDbAdapter is read-only');
  }

  async getCallRecordsForServer(
    serverName: string,
    limit?: number,
    tenantId?: string,
  ): Promise<ProxyCallRecord[]> {
    let recs = this.records.filter((r) => r.serverName === serverName);
    if (tenantId) {
      recs = recs.filter((r) => (r.tenantId || 'default') === tenantId);
    }
    recs = [...recs].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    if (limit != null && limit > 0) recs = recs.slice(0, limit);
    return recs;
  }

  async transactionSync<T>(fn: () => T): Promise<T> {
    return fn();
  }

  async transaction<T>(fn: () => Promise<T> | T): Promise<T> {
    return fn();
  }

  flush(): void {}

  async close(): Promise<void> {}
}
