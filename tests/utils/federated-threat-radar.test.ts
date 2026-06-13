import { describe, expect, it } from 'vitest';
import {
  buildLocalFederatedStats,
  mergeFederatedStats,
} from '../../src/utils/federated-threat-radar.js';
import type { StoredSemanticAudit } from '../../src/ai/semantic-audit-store.js';

describe('federated-threat-radar', () => {
  it('builds anonymized local stats', () => {
    const records: StoredSemanticAudit[] = [
      {
        id: '1',
        tenantId: 'default',
        requestId: 'r1',
        serverName: 'fs',
        toolName: 'run',
        syncDecision: { action: 'block', rule: 'path-guard', reason: 'x' },
        semanticAudit: {
          suspicious: true,
          confidence: 0.9,
          categories: ['prompt-injection'],
          reasoning: 'test',
        },
        timestamp: new Date().toISOString(),
      },
    ];
    const stats = buildLocalFederatedStats('default', 'us-east-1', records);
    expect(stats.attackClassCounts['prompt-injection']).toBe(1);
    expect(stats.ruleEfficacy[0].rule).toBe('path-guard');
    expect(stats.optIn).toBe(process.env.MASTYFF_AI_FEDERATED_LEARNING === 'true');
  });

  it('merges stats across instances', () => {
    const a = buildLocalFederatedStats('t', 'r1', []);
    a.attackClassCounts = { injection: 2 };
    a.ruleEfficacy = [{ rule: 'r1', blocks: 3 }];
    const b = buildLocalFederatedStats('t', 'r2', []);
    b.attackClassCounts = { injection: 1 };
    b.ruleEfficacy = [{ rule: 'r1', blocks: 2 }];
    const merged = mergeFederatedStats([a, b]);
    expect(merged.attackClassCounts.injection).toBe(3);
    expect(merged.ruleEfficacy[0].blocks).toBe(5);
    expect(merged.instanceCount).toBe(2);
  });
});
