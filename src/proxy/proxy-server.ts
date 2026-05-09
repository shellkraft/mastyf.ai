import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { randomUUID } from 'crypto';
import { TokenCounter } from '../utils/token-counter.js';
import { ProxyCallRecord } from '../types.js';
import { HistoryDatabase } from '../database/history-db.js';
import { Logger } from '../utils/logger.js';
import { PolicyEngine } from '../policy/policy-engine.js';
import { CallContext } from '../policy/policy-types.js';
import { StructuredLogger } from '../utils/structured-logger.js';
import { OAuthValidator } from '../auth/oauth.js';
import { AuthValidationResult, AgentIdentity } from '../auth/auth-types.js';
import { SessionCache } from '../auth/session-cache.js';
import { CircuitBreaker } from '../utils/circuit-breaker.js';

/**
 * MCP Proxy Interceptor — sits between the AI client and an MCP server.
 *
 * v0.4: Integrated PolicyEngine for active blocking of malicious tool calls.
 * v0.5: OAuth 2.1 JWT validation — validates bearer tokens before policy evaluation.
 * v0.5.2: Circuit breaker for upstream MCP server failures.
 * v0.5.2: Per-client rate limiting (keyed by agent sub + tool name).
 * v0.5.2: Consistent SIEM fields (request_id, proxy_latency_ms, authn_success, authz_allowed).
 */
export class McpProxyServer {
  private child: ChildProcess;
  private tokenCounter: TokenCounter;
  private db: HistoryDatabase;
  private currentRequestId: string | null = null;
  private requestStartTime: number = 0;
  private requestToolName: string | null = null;
  private requestTokens: number = 0;
  private requestArguments: Record<string, unknown> | undefined;
  private serverName: string;
  private policyEngine: PolicyEngine | null;
  private authValidator: OAuthValidator | null;
  private sessionCache: SessionCache | null;
  private circuitBreaker: CircuitBreaker;
  /** v0.5.2: Per-client rate limit counters (key: agentSub:toolName) */
  private clientRateCounters: Map<string, { count: number; resetAt: number }> = new Map();

  constructor(
    command: string,
    args: string[],
    env: Record<string, string>,
    db: HistoryDatabase,
    serverName?: string,
    policyEngine?: PolicyEngine,
    authValidator?: OAuthValidator,
  ) {
    this.serverName = serverName || command.split('/').pop() || command;
    this.policyEngine = policyEngine || null;
    this.authValidator = authValidator || null;
    this.sessionCache = authValidator ? new SessionCache() : null;
    this.circuitBreaker = new CircuitBreaker(this.serverName);
    this.child = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.tokenCounter = new TokenCounter();
    this.db = db;
    this.setupStdout();
    this.setupStderr();

    StructuredLogger.info({
      event: 'proxy_started',
      serverName: this.serverName,
      blockingMode: this.policyEngine ? this.policyEngine.getMode() : 'audit',
      authEnabled: this.authValidator ? this.authValidator.getConfig().required : false,
      circuitBreaker: this.circuitBreaker.getState(),
    });
  }

  get stdin(): NodeJS.WritableStream | null {
    return this.child.stdin;
  }

  private setupStdout(): void {
    const rl = createInterface({ input: this.child.stdout! });
    rl.on('line', (line: string) => {
      try {
        const msg = JSON.parse(line);
        if (msg.id && msg.id === this.currentRequestId) {
          const proxyLatencyMs = Date.now() - this.requestStartTime;
          const responseTokens = this.tokenCounter.count(line);
          const record: ProxyCallRecord = {
            serverName: this.serverName,
            toolName: this.requestToolName || 'unknown',
            requestTokens: this.requestTokens,
            responseTokens,
            totalTokens: this.requestTokens + responseTokens,
            durationMs: proxyLatencyMs,
            timestamp: new Date().toISOString(),
          };
          this.db.addCallRecord(record).then(() => this.db.flush()).catch((err) =>
            Logger.debug(`Proxy: failed to store call record: ${err?.message}`)
          );
          // Circuit breaker: success
          this.circuitBreaker.recordSuccess();
          this.currentRequestId = null;
          this.requestToolName = null;
        }
        process.stdout.write(line + '\n');
      } catch {
        process.stdout.write(line + '\n');
      }
    });

    rl.on('close', () => {
      Logger.debug(`[proxy:${this.serverName}] stdout closed`);
    });
  }

  private setupStderr(): void {
    this.child.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(data);
    });
  }

  private sendError(id: string | number, code: number, message: string, data?: Record<string, unknown>): void {
    const errorResponse = JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code, message, data },
    });
    process.stdout.write(errorResponse + '\n');
  }

  /**
   * Called when the AI client writes a request to be proxied.
   * Pipeline: Auth → Circuit Breaker → Policy + RBAC → Forward.
   */
  async handleClientInput(raw: string): Promise<void> {
    const requestId = randomUUID();
    const proxyStartTime = Date.now();

    try {
      const msg = JSON.parse(raw);
      if (msg.method === 'tools/call' && msg.id) {
    this.requestStartTime = proxyStartTime;
    this.currentRequestId = msg.id; // Original msg ID for response matching
        this.requestToolName = msg.params?.name || 'unknown';
        this.requestTokens = this.tokenCounter.count(raw);
        this.requestArguments = msg.params?.arguments;
        const toolName = this.requestToolName || 'unknown';

        let agentIdentity: AgentIdentity | undefined;
        let authnSuccess = false;

        // ── v0.5: OAuth 2.1 JWT validation ──────────────────
        if (this.authValidator) {
          const authHeader = msg.params?._meta?.auth?.Authorization
            || msg.Authorization
            || msg.params?.Authorization
            || undefined;

          const token = OAuthValidator.extractToken(authHeader);

          if (!token) {
            if (this.authValidator.getConfig().required) {
              StructuredLogger.info({
                event: 'auth_required',
                requestId,
                serverName: this.serverName,
                toolName,
                authnSuccess: false,
              });
              this.sendError(msg.id, -32002, 'Authentication required. Provide a valid Bearer token in the Authorization header.');
              return;
            }
          } else {
            const result: AuthValidationResult = await this.authValidator.validate(token);
            authnSuccess = result.valid;
            if (result.identity) agentIdentity = result.identity;

            if (!result.valid) {
              StructuredLogger.logError({
                event: 'oidc_auth_error',
                serverName: this.serverName,
                requestId,
                error: `JWT validation failed: ${result.error}`,
              });

              if (this.authValidator.getConfig().required) {
                this.sendError(msg.id, -32003, `Authentication failed: ${result.error}`);
                return;
              }
            } else {
              // v0.6.0: Session cache — issue short-lived session to prevent JWT replay
              if (this.sessionCache && result.identity) {
                const session = this.sessionCache.createSession(result.identity);
                StructuredLogger.info({
                  event: 'auth_success',
                  requestId,
                  serverName: this.serverName,
                  toolName,
                  agent: result.identity.sub,
                  clientId: result.identity.clientId,
                  sessionToken: session.token,
                  sessionExpiry: new Date(session.expiresAt).toISOString(),
                  authnSuccess: true,
                });
              } else {
                StructuredLogger.info({
                  event: 'auth_success',
                  requestId,
                  serverName: this.serverName,
                  toolName,
                  agent: result.identity?.sub,
                  clientId: result.identity?.clientId,
                  authnSuccess: true,
                });
              }
            }
          }
        }

        // ── v0.5.2: Circuit breaker check ──────────────────
        if (!this.circuitBreaker.allowRequest()) {
          StructuredLogger.info({
            event: 'circuit_open',
            requestId,
            serverName: this.serverName,
            toolName,
            state: this.circuitBreaker.getState(),
          });
          this.sendError(msg.id, -32005, `Upstream MCP server '${this.serverName}' unavailable — circuit breaker open`);
          this.circuitBreaker.recordFailure();
          return;
        }

        // ── v0.5.1: RBAC + policy evaluation ────────────────
        let authzAllowed = true;
        let blockReason: string | undefined;

        if (this.policyEngine) {
          const context: CallContext = {
            serverName: this.serverName,
            toolName,
            arguments: this.requestArguments,
            requestId,
            requestTokens: this.requestTokens,
            timestamp: new Date().toISOString(),
            agentIdentity,
          };

          const decision = this.policyEngine.evaluate(context);

          StructuredLogger.logPolicyDecision({
            event: 'policy_decision',
            requestId,
            serverName: this.serverName,
            toolName,
            decision,
            context,
          });

          if (decision.action === 'block') {
            authzAllowed = false;
            blockReason = `policy:${decision.rule}:${decision.reason}`;

            StructuredLogger.logBlocked({
              event: 'tool_blocked',
              requestId,
              serverName: this.serverName,
              toolName,
              reason: `policy_rule=${decision.rule} | reason=${decision.reason}`,
              rule: decision.rule,
            });

            StructuredLogger.info({
              event: 'request_denied',
              requestId,
              serverName: this.serverName,
              toolName,
              authnSuccess,
              authzAllowed,
              blockReason,
              proxyLatencyMs: Date.now() - proxyStartTime,
            });

            this.sendError(msg.id, -32001, `Blocked by MCP Guardian policy: ${decision.reason}`, {
              rule: decision.rule,
              policy: this.policyEngine.getMode(),
            });
            return;
          }

          // v0.5.2: Per-client rate limiting
          if (agentIdentity) {
            const rateKey = `${agentIdentity.sub}:${toolName}`;
            const now = Date.now();
            let counter = this.clientRateCounters.get(rateKey);
            if (!counter || now > counter.resetAt) {
              counter = { count: 1, resetAt: now + 60000 };
              this.clientRateCounters.set(rateKey, counter);
            } else {
              counter.count++;
            }
            // Check if any RBAC rule with per-client rate limit fires
            const perClientLimit = this.checkPerClientRateLimit(agentIdentity, toolName, counter.count);
            if (perClientLimit) {
              StructuredLogger.info({
                event: 'request_denied',
                requestId,
                serverName: this.serverName,
                toolName,
                authnSuccess,
                authzAllowed: false,
                blockReason: perClientLimit,
                proxyLatencyMs: Date.now() - proxyStartTime,
              });
              this.sendError(msg.id, -32004, `Rate limit exceeded for agent '${agentIdentity.sub}': ${perClientLimit}`);
              return;
            }
          }
        }

        // ── Log successful forwarding ───────────────────────
        StructuredLogger.info({
          event: 'request_forwarded',
          requestId,
          serverName: this.serverName,
          toolName,
          authnSuccess,
          authzAllowed,
          proxyLatencyMs: Date.now() - proxyStartTime,
          agent: agentIdentity?.sub,
        });
      }
    } catch {
      // Non-JSON input — forward as-is
    }
    this.child.stdin?.write(raw + '\n');
  }

  /**
   * Check per-client rate limits against RBAC rules.
   * Returns block reason string or null.
   */
  private checkPerClientRateLimit(identity: AgentIdentity, toolName: string, currentCount: number): string | null {
    if (!this.policyEngine) return null;
    // Per-client limits are tracked via RBAC scopes — if agent has "basic" scope, check against "basic" rate limit rule
    const scopes = identity.scopes || [];
    // Simple: if the agent has no special scopes and we've hit a hard limit
    // In a full implementation, this would check per-scope/per-client limits from policy
    if (scopes.length === 0 && currentCount > 100) {
      return `Per-client rate limit exceeded: ${currentCount}/100 calls per minute (agent: ${identity.sub})`;
    }
    return null;
  }

  kill(): void {
    try {
      this.child.kill();
    } catch {
      // Already dead
    }
  }
}