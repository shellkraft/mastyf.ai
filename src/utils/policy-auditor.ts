/**
 * Policy Audit Trail — records every policy change for compliance.
 * Logs: who changed what, when, old/new values, and rollback info.
 * Enable with: POLICY_AUDIT_ENABLED=true
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { Logger } from './logger.js';

export interface PolicyChangeRecord {
  timestamp: string;
  actor: string;
  change: string;
  oldValue?: string;
  newValue?: string;
  sourceHash?: string;
}

export class PolicyAuditor {
  private auditPath: string;
  private enabled: boolean;
  private lastHash: string | null = null;

  constructor(auditPath?: string) {
    this.enabled = process.env['POLICY_AUDIT_ENABLED'] === 'true';
    this.auditPath = auditPath || process.env['POLICY_AUDIT_LOG'] || './policy-audit.jsonl';
  }

  record(change: PolicyChangeRecord): void {
    if (!this.enabled) return;
    try {
      const line = JSON.stringify({ ...change, source: 'mcp-guardian-policy-auditor' }) + '\n';
      writeFileSync(this.auditPath, line, { flag: 'a' });
      Logger.debug(`[policy-auditor] Change recorded: ${change.change}`);
    } catch (err: any) {
      Logger.error(`[policy-auditor] Failed to write audit log: ${err?.message}`);
    }
  }

  readAuditTrail(): PolicyChangeRecord[] {
    if (!existsSync(this.auditPath)) return [];
    try {
      const content = readFileSync(this.auditPath, 'utf-8');
      return content.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
    } catch {
      return [];
    }
  }

  computeHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(16);
  }

  hasChanged(content: string): boolean {
    const currentHash = this.computeHash(content);
    if (this.lastHash && this.lastHash !== currentHash) {
      this.lastHash = currentHash;
      return true;
    }
    this.lastHash = currentHash;
    return false;
  }
}