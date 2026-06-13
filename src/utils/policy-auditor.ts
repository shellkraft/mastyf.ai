/**
 * Policy Audit Trail — records every policy change for compliance.
 * Logs: who changed what, when, old/new values, and rollback info.
 * Enable with: POLICY_AUDIT_ENABLED=true
 */

import { createHash } from 'crypto';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { Logger } from './logger.js';
import { appendChainedJsonlLine, isAuditHashChainEnabled } from './audit-hash-chain.js';
import { resolveTenantPolicyAuditJsonl } from '../audit/tenant-audit-paths.js';

export interface PolicyChangeRecord {
  timestamp: string;
  actor: string;
  change: string;
  oldValue?: string;
  newValue?: string;
  sourceHash?: string;
  residency_region?: string;
}

export class PolicyAuditor {
  private auditPath: string;
  private enabled: boolean;
  private lastHash: string | null = null;

  constructor(auditPath?: string, tenantId?: string) {
    this.enabled = process.env['POLICY_AUDIT_ENABLED'] === 'true';
    this.auditPath =
      auditPath
      || process.env['POLICY_AUDIT_LOG']
      || (process.env['MASTYFF_AI_TENANT_AUDIT_PATHS'] !== 'false'
        ? resolveTenantPolicyAuditJsonl(tenantId)
        : './policy-audit.jsonl');
  }

  record(change: PolicyChangeRecord): void {
    if (!this.enabled) return;
    try {
      const residencyRegion = process.env.MASTYFF_AI_REGION || 'default';
      const payload = { ...change, source: 'mastyff-ai-policy-auditor', residency_region: residencyRegion };
      if (isAuditHashChainEnabled()) {
        appendChainedJsonlLine(this.auditPath, payload);
      } else {
        const line = JSON.stringify(payload) + '\n';
        writeFileSync(this.auditPath, line, { flag: 'a' });
      }
      Logger.debug(`[policy-auditor] Change recorded: ${change.change}`);
    } catch (err: unknown) {
      Logger.error(`[policy-auditor] Failed to write audit log: ${err instanceof Error ? err.message : String(err)}`);
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
    return createHash('sha256').update(content).digest('hex');
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