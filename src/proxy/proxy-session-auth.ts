/**
 * MCP session-scoped auth headers (stdio sticky OAuth).
 */
export class ProxySessionAuthStore {
  private readonly bySession = new Map<string, { authHeader: string; updatedAt: number }>();

  setForSession(sessionId: string, authHeader: string): void {
    if (!sessionId || !authHeader) return;
    this.bySession.set(sessionId, { authHeader, updatedAt: Date.now() });
  }

  onSessionChange(previousSessionId: string | null, newSessionId: string): void {
    if (previousSessionId && previousSessionId !== newSessionId) {
      this.bySession.delete(previousSessionId);
    }
  }

  getAuthHeader(
    sessionId: string | null | undefined,
    perMessageAuth: string | undefined,
    stickyEnabled: boolean,
  ): string | undefined {
    if (perMessageAuth) return perMessageAuth;
    if (!stickyEnabled || !sessionId) return undefined;
    return this.bySession.get(sessionId)?.authHeader;
  }

  hasSessionAuth(sessionId: string | null | undefined): boolean {
    if (!sessionId) return false;
    return this.bySession.has(sessionId);
  }

  clearAll(): void {
    this.bySession.clear();
  }

  clearExcept(sessionId: string | null | undefined): void {
    if (!sessionId) {
      this.clearAll();
      return;
    }
    for (const key of [...this.bySession.keys()]) {
      if (key !== sessionId) this.bySession.delete(key);
    }
  }
}
