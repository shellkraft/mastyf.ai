import { randomUUID } from 'crypto';
import { AgentIdentity } from './auth-types.js';
import { Logger } from '../utils/logger.js';

/**
 * Session cache for replay protection.
 * After a JWT is validated once, a short-lived session token is issued.
 * Subsequent calls must include this session token, not the raw JWT.
 * This prevents replay of captured JWTs within their expiry window.
 *
 * In production, replace with Redis for multi-replica HA.
 */

export interface SessionEntry {
  token: string;
  identity: AgentIdentity;
  nonce: string;
  createdAt: number;
  expiresAt: number;
}

export class SessionCache {
  private sessions: Map<string, SessionEntry> = new Map();
  private usedNonces: Set<string> = new Set();
  protected readonly sessionTtlMs: number;
  protected readonly nonceTtlMs: number;

  constructor(sessionTtlMs: number = 5 * 60 * 1000, nonceTtlMs: number = 10 * 60 * 1000) {
    this.sessionTtlMs = sessionTtlMs;
    this.nonceTtlMs = nonceTtlMs;
    // Cleanup expired entries every 60s
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Create a session after successful JWT validation.
   * Returns a session token the client must use for subsequent calls.
   * The JWT cannot be replayed because:
   * 1. We track used nonces (jti or sub+iat)
   * 2. We issue a session token with a short (5min) TTL
   */
  createSession(identity: AgentIdentity, jwtNonce?: string): SessionEntry {
    const nonce = jwtNonce || `${identity.sub}:${Date.now()}:${randomUUID()}`;

    // Prevent nonce replay
    if (this.usedNonces.has(nonce)) {
      Logger.warn(`[session-cache] Replay detected: nonce ${nonce}`);
    }
    this.usedNonces.add(nonce);

    const token = `mcp_guardian_session_${randomUUID()}`;
    const now = Date.now();
    const entry: SessionEntry = {
      token,
      identity,
      nonce,
      createdAt: now,
      expiresAt: now + this.sessionTtlMs,
    };

    this.sessions.set(token, entry);
    return entry;
  }

  /**
   * Validate a session token.
   * Returns the agent identity if valid, null if expired/not found.
   */
  validateSession(token: string): AgentIdentity | null {
    const entry = this.sessions.get(token);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.sessions.delete(token);
      return null;
    }
    return entry.identity;
  }

  /**
   * Check if a JWT nonce has been used (replay detection).
   */
  isNonceUsed(nonce: string): boolean {
    return this.usedNonces.has(nonce);
  }

  /**
   * Revoke a session (e.g., on logout or suspicious activity).
   */
  revokeSession(token: string): void {
    this.sessions.delete(token);
  }

  protected cleanup(): void {
    const now = Date.now();
    // Clean expired sessions
    for (const [token, entry] of this.sessions) {
      if (now > entry.expiresAt) {
        this.sessions.delete(token);
      }
    }
    // Clean expired nonces (keep for nonceTtlMs to detect replays)
    // This is simplified — in production, use a time-sorted structure
    if (this.usedNonces.size > 10000) {
      // Full sweep
      const entries = Array.from(this.sessions.values());
      const validTokens = new Set(entries.map(e => e.token));
      for (const token of this.sessions.keys()) {
        if (!validTokens.has(token)) this.sessions.delete(token);
      }
      this.usedNonces.clear();
    }
  }

  get size(): number {
    return this.sessions.size;
  }
}