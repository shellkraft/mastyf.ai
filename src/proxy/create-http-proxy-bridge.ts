/**
 * Monorepo bridge: wires root OAuthValidator + mTLS into packages/server createHttpProxy.
 * Not intended for isolated packages/server npm publish — use HttpProxyServer for production.
 */
import {
  createHttpProxy,
  type CreateHttpProxyOptions,
  type HttpProxyAuthValidator,
} from '@mastyf-ai/mcp-server/http-proxy';
import { OAuthValidator } from '../auth/oauth.js';
import type { AuthConfig } from '../auth/auth-types.js';
import { getMtlsAgent } from '../utils/mtls-agent-registry.js';
import type http from 'http';
import type https from 'https';

interface TokenCounterLike { count(text: string): number; }
interface PolicyEngineLike { evaluate(c: any): { action: string; rule: string; reason: string }; }
interface DatabaseLike { addCallRecord(r: any): Promise<void>; }

function asHttpProxyAuthValidator(oauth: OAuthValidator): HttpProxyAuthValidator {
  return {
    getConfig: () => ({ required: oauth.getConfig().required }),
    validate: async (token) => {
      const result = await oauth.validate(token);
      return { valid: result.valid, error: result.error };
    },
    extractToken: (header) => OAuthValidator.extractToken(header),
  };
}

export function buildAuthConfigFromEnv(): AuthConfig | null {
  const issuer = process.env['MASTYF_AI_AUTH_ISSUER'];
  const audience = process.env['MASTYF_AI_AUTH_AUDIENCE'];
  if (!issuer || !audience) return null;
  return {
    issuer,
    audience,
    required: process.env['MASTYF_AI_AUTH_REQUIRED'] === 'true',
  };
}

export function createHttpProxyWithOAuth(
  targetUrl: string,
  policyEngine: PolicyEngineLike | null,
  db: DatabaseLike,
  tokenCounter: TokenCounterLike,
  options: CreateHttpProxyOptions & { authConfig?: AuthConfig | null } = {},
): http.Server | https.Server {
  const authConfig = options.authConfig ?? buildAuthConfigFromEnv();
  const authValidator = authConfig
    ? asHttpProxyAuthValidator(new OAuthValidator(authConfig))
    : options.authValidator ?? null;

  return createHttpProxy(targetUrl, policyEngine, db, tokenCounter, {
    ...options,
    authValidator: authValidator ?? undefined,
    upstreamAgent: 'upstreamAgent' in options ? options.upstreamAgent : getMtlsAgent(),
  });
}

export { OAuthValidator };
