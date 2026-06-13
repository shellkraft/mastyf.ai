import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { runSyncSemanticRequestGate } from '../../src/proxy/proxy-post-policy-gates.js';

type Fixture = {
  name: string;
  context: {
    serverName: string;
    toolName: string;
    arguments: Record<string, unknown>;
    agentId: string;
    tenantId: string;
  };
  decision: {
    action: 'pass' | 'block' | 'flag';
    rule: string;
    reason: string;
  };
  expectedRuleOnBlock: string | null;
};

const fixtures = JSON.parse(
  readFileSync('tests/fixtures/transport-parity-contract.json', 'utf-8'),
) as Fixture[];

describe('transport parity contract', () => {
  it('keeps shared post-policy gate behavior stable', async () => {
    process.env.MASTYFF_AI_SEMANTIC_SYNC_REQUEST = 'true';
    process.env.MASTYFF_AI_SEMANTIC_SYNC_REQUEST_LLM = 'true';
    process.env.MASTYFF_AI_SEMANTIC_FAIL_CLOSED_MEDIUM = 'false';

    for (const fx of fixtures) {
      const result = await runSyncSemanticRequestGate(
        fx.context,
        fx.decision,
        fx.context.serverName,
      );
      if (!fx.expectedRuleOnBlock) {
        expect(result.block, fx.name).toBe(false);
      } else {
        if (result.block) {
          expect(result.rule, fx.name).toBe(fx.expectedRuleOnBlock);
        }
      }
    }
  });
});
