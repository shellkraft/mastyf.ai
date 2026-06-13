import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  appendDashboardAccessLog,
  readDashboardAccessLog,
} from '../../src/audit/dashboard-access-log.js';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('dashboard access log', () => {
  const prevHome = process.env.MASTYFF_AI_HOME;
  let tempHome: string;

  beforeEach(() => {
    tempHome = mkdtempSync(join(tmpdir(), 'mastyff-ai-audit-'));
    process.env.MASTYFF_AI_HOME = tempHome;
  });

  afterEach(() => {
    if (prevHome === undefined) delete process.env.MASTYFF_AI_HOME;
    else process.env.MASTYFF_AI_HOME = prevHome;
    try {
      rmSync(tempHome, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('records userId, tenantId, endpoint, timestamp', () => {
    appendDashboardAccessLog({
      userId: 'alice',
      tenantId: 'acme',
      method: 'GET',
      path: '/api/audit',
      status: 200,
      ip: '127.0.0.1',
    });
    const entries = readDashboardAccessLog('acme', 10);
    expect(entries.length).toBe(1);
    const e = entries[0];
    expect(e.userId).toBe('alice');
    expect(e.tenantId).toBe('acme');
    expect(e.endpoint).toBe('/api/audit');
    expect(e.path).toBe('/api/audit');
    expect(e.timestamp).toBeTruthy();
    expect(Date.parse(e.timestamp)).not.toBeNaN();
  });
});
