import { PolicyConfig, PolicyDecision, CallContext, PolicyAction, PolicyMode } from './policy-types.js';
import { Logger } from '../utils/logger.js';
import { getNormalizer } from '../utils/payload-normalizer.js';
import { ShellTokenizer, CommandRisk } from './shell-tokenizer.js';
import { LRUCache } from 'lru-cache';

/**
 * Policy Engine — evaluates every intercepted tools/call against configured rules.
 * Supports three modes: audit (passive), warn (flag only), block (active enforcement).
 *
 * v1.2: Integrated payload normalization and semantic shell analysis layers
 * v2.1: Replaced Map with LRUCache to prevent memory leaks under sustained load
 */
export class PolicyEngine {
  private rules: PolicyConfig['policy']['rules'];
  private mode: PolicyMode;
  private callCounters: LRUCache<string, { count: number; resetAt: number }> = new LRUCache({
    max: 50000,
    ttl: 60000,
    updateAgeOnGet: true,
  });
  private normalizer = getNormalizer();
  private shellTokenizer = new ShellTokenizer();

  constructor(config: PolicyConfig) {
    this.rules = config.policy.rules;
    this.mode = config.policy.mode;
  }

  /**
   * Evaluate a tools/call request and return a decision.
   *
   * Pipeline: Normalize payload → Semantic shell analysis → Rule evaluation
   */
  evaluate(context: CallContext): PolicyDecision {
    // ── v1.2: Payload normalization (before regex evaluation) ──
    const normalizedArgs = context.arguments
      ? this.normalizer.normalizeJsonValue(context.arguments) as Record<string, unknown>
      : {};
    const normalizedContext: CallContext = {
      ...context,
      arguments: normalizedArgs,
    };

    // ── v1.2: Semantic shell analysis on argument strings ──
    const argsStr = JSON.stringify(normalizedArgs);
    const shellRisk: CommandRisk = argsStr.length > 0
      ? this.shellTokenizer.analyzeRisk(this.shellTokenizer.tokenize(argsStr).commands)
      : { hasCommandSubstitution: false, hasPipes: false, hasRedirects: false, hasLogicalChains: false, dangerousCommands: [], shellMetacharacters: [] };

    // Check for high-risk semantic patterns regardless of rule match
    if (shellRisk.hasCommandSubstitution) {
      Logger.info(`[policy] Semantic: command substitution detected in '${context.toolName}' arguments`);
    }
    if (shellRisk.dangerousCommands.length > 0) {
      Logger.info(`[policy] Semantic: dangerous commands [${shellRisk.dangerousCommands.join(', ')}] in '${context.toolName}' arguments`);
    }

    for (const rule of this.rules) {
      const decision = this.evaluateRule(rule, normalizedContext, { argsStr, shellRisk });
      if (decision) return decision;
    }

    // Default: pass
    return { action: 'pass', rule: 'default', reason: 'No policy rules matched' };
  }

  private evaluateRule(
    rule: PolicyConfig['policy']['rules'][number],
    ctx: CallContext,
    analysis: { argsStr: string; shellRisk: CommandRisk },
  ): PolicyDecision | null {
    // Tool allowlist/denylist
    if (rule.tools) {
      if (rule.tools.allow && rule.tools.allow.length > 0) {
        if (!rule.tools.allow.includes(ctx.toolName)) {
          return { action: this.resolveAction(rule.action), rule: rule.name, reason: `Tool '${ctx.toolName}' not in allowlist: [${rule.tools.allow.join(', ')}]` };
        }
      }
      if (rule.tools.deny && rule.tools.deny.length > 0) {
        if (rule.tools.deny.includes(ctx.toolName)) {
          return { action: this.resolveAction(rule.action), rule: rule.name, reason: `Tool '${ctx.toolName}' is explicitly denied` };
        }
      }
    }

    // v2.2: Tool category matching (e.g., destructive operations)
    if (rule.toolCategories?.deny) {
      const toolLower = ctx.toolName.toLowerCase();
      const matchesCategory = rule.toolCategories.deny.some(
        (cat) => toolLower.includes(cat.toLowerCase())
      );
      const isException = (rule.toolAllowExceptions ?? []).includes(ctx.toolName);
      if (matchesCategory && !isException) {
        return {
          action: this.resolveAction(rule.action),
          rule: rule.name,
          reason: `Tool '${ctx.toolName}' matches destructive category in rule '${rule.name}'`,
        };
      }
    }

    // v2.2: Argument-level field patterns (e.g., block /etc/ in 'path' arguments)
    if (rule.argPatterns && rule.argPatterns.length > 0 && ctx.arguments) {
      for (const { field, patterns } of rule.argPatterns) {
        const values: string[] =
          field === '*'
            ? Object.values(ctx.arguments).map((v) => String(v))
            : ctx.arguments[field] !== undefined
            ? [String(ctx.arguments[field])]
            : [];
        for (const value of values) {
          for (const pattern of patterns) {
            try {
              if (new RegExp(pattern, 'i').test(value)) {
                return {
                  action: this.resolveAction(rule.action),
                  rule: rule.name,
                  reason: `Argument field '${field}' matches blocked pattern '${pattern}' in rule '${rule.name}'`,
                };
              }
            } catch {
              Logger.warn(`Policy: invalid argPattern regex in rule '${rule.name}': ${pattern}`);
            }
          }
        }
      }
    }

    // v1.2: Malicious pattern detection — runs against NORMALIZED payload
    if (rule.patterns) {
      for (const pattern of rule.patterns) {
        try {
          if (new RegExp(pattern).test(analysis.argsStr)) {
            return { action: this.resolveAction(rule.action), rule: rule.name, reason: `Argument pattern '${pattern}' matched in tool call (normalized)` };
          }
        } catch {
          Logger.warn(`Policy: invalid regex pattern in rule '${rule.name}': ${pattern}`);
        }
      }
    }

    // v1.2: Semantic shell detection rule — automatic high-risk pattern block
    if (rule.name === 'block-shell-injection' || rule.name.includes('shell')) {
      // Command substitution is always high-risk
      if (analysis.shellRisk.hasCommandSubstitution) {
        return { action: this.resolveAction('block'), rule: rule.name, reason: 'Semantic: shell command substitution detected in arguments' };
      }

      // Dangerous commands in any context
      if (analysis.shellRisk.dangerousCommands.length > 0) {
        return {
          action: this.resolveAction('block'),
          rule: rule.name,
          reason: `Semantic: dangerous shell commands detected: [${analysis.shellRisk.dangerousCommands.join(', ')}]`,
        };
      }

      // Pipe chains with dangerous patterns
      if (analysis.shellRisk.hasPipes && analysis.shellRisk.hasCommandSubstitution) {
        return { action: this.resolveAction('block'), rule: rule.name, reason: 'Semantic: pipe chain with command substitution' };
      }
    }

    // Max tokens per call
    if (rule.maxTokens && ctx.requestTokens > rule.maxTokens) {
      return { action: this.resolveAction(rule.action), rule: rule.name, reason: `Token count ${ctx.requestTokens} exceeds max ${rule.maxTokens}` };
    }

    // v0.5.1: RBAC — scope and client_id constraints
    if (rule.rbac) {
      const identity = ctx.agentIdentity;
      if (!identity) {
        return { action: this.resolveAction(rule.action), rule: rule.name, reason: `RBAC rule '${rule.name}' requires agent identity but none provided` };
      }
      if (rule.rbac.scopes && rule.rbac.scopes.length > 0) {
        const agentScopes = identity.scopes || [];
        const hasScope = rule.rbac.scopes.some(s => agentScopes.includes(s));
        if (!hasScope) {
          return { action: this.resolveAction(rule.action), rule: rule.name, reason: `Agent '${identity.sub}' missing required scope. Need one of: [${rule.rbac.scopes.join(', ')}], have: [${agentScopes.join(', ') || 'none'}]` };
        }
      }
      if (rule.rbac.clientIds && rule.rbac.clientIds.length > 0) {
        const clientId = identity.clientId || '';
        const matches = rule.rbac.clientIds.some(pattern => new RegExp(pattern).test(clientId));
        if (!matches) {
          return { action: this.resolveAction(rule.action), rule: rule.name, reason: `Client ID '${clientId}' not allowed. Allowed patterns: [${rule.rbac.clientIds.join(', ')}]` };
        }
      }
    }

    // Rate limiting (LRU-backed, prevents memory leaks)
    if (rule.maxCallsPerMinute) {
      const key = `${ctx.serverName}:${ctx.toolName}`;
      const now = Date.now();
      let counter = this.callCounters.get(key);
      if (!counter || now > counter.resetAt) {
        counter = { count: 1, resetAt: now + 60000 };
      } else {
        counter.count++;
      }
      this.callCounters.set(key, counter);
      if (counter.count > rule.maxCallsPerMinute) {
        return { action: this.resolveAction(rule.action), rule: rule.name, reason: `Rate limit exceeded: ${counter.count}/${rule.maxCallsPerMinute} calls per minute` };
      }
    }

    return null;
  }

  private resolveAction(ruleAction: PolicyAction): PolicyAction {
    if (this.mode === 'audit') return 'pass';
    if (this.mode === 'warn' && ruleAction === 'block') return 'flag';
    return ruleAction;
  }

  getMode(): PolicyMode {
    return this.mode;
  }

  /** Expose the shell tokenizer for testing */
  getShellTokenizer(): ShellTokenizer {
    return this.shellTokenizer;
  }
}
