import * as jose from 'jose';
import { DPoPValidator } from './dpop.js';
import { Logger } from '../utils/logger.js';

let sharedValidator: DPoPValidator | null = null;

function getValidator(): DPoPValidator {
  if (!sharedValidator) {
    sharedValidator = new DPoPValidator();
  }
  return sharedValidator;
}

export function resetDpopEnforcementForTests(): void {
  sharedValidator = null;
}

/** Legacy bypass for deployments that cannot send DPoP yet. */
export function isDpopLegacyBypass(): boolean {
  return process.env['MASTYFF_AI_LEGACY_NO_DPOP'] === 'true';
}

/** When true, proxy rejects requests without a valid DPoP proof (RFC 9449). */
export function isDpopRequired(policyMode?: 'audit' | 'warn' | 'block'): boolean {
  if (isDpopLegacyBypass()) return false;
  if (process.env['MASTYFF_AI_REQUIRE_DPOP'] === 'true') return true;
  if (process.env['MASTYFF_AI_BLOCKING_MODE'] === 'true') return true;
  if (policyMode === 'block') return true;
  return false;
}

/**
 * Validate DPoP when MASTYFF_AI_REQUIRE_DPOP=true.
 * Proof JWT must include `jwk` in the protected header (RFC 9449).
 */
export async function validateRequiredDpop(
  proofToken: string | undefined,
  httpMethod: string,
  httpUri: string,
  accessToken?: string,
  tenantId?: string,
  policyMode?: 'audit' | 'warn' | 'block',
): Promise<{ valid: boolean; error?: string }> {
  if (!isDpopRequired(policyMode)) {
    return { valid: true };
  }

  if (!proofToken) {
    return {
      valid: false,
      error: 'DPoP proof required (set MASTYFF_AI_REQUIRE_DPOP=true). Send DPoP header with proof JWT.',
    };
  }

  try {
    const header = jose.decodeProtectedHeader(proofToken);
    if (!header.jwk || typeof header.jwk !== 'object') {
      return {
        valid: false,
        error: 'DPoP proof must include jwk in the JWT protected header',
      };
    }

    const result = await getValidator().validate(
      proofToken,
      header.jwk as jose.JWK,
      httpMethod,
      httpUri,
      accessToken,
      tenantId,
    );

    if (!result.valid) {
      Logger.warn(`[dpop] Enforcement failed: ${result.error}`);
    }
    return { valid: result.valid, error: result.error };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: `DPoP enforcement error: ${message}` };
  }
}

/** Extract DPoP proof from MCP JSON-RPC meta or HTTP headers. */
export function extractDpopProof(
  sources: {
    metaAuth?: Record<string, unknown>;
    messageDpop?: string;
    headerDpop?: string | string[];
  },
): string | undefined {
  const fromMeta = sources.metaAuth?.['DPoP'] ?? sources.metaAuth?.['dpop'];
  if (typeof fromMeta === 'string' && fromMeta.length > 0) return fromMeta;
  if (typeof sources.messageDpop === 'string' && sources.messageDpop.length > 0) {
    return sources.messageDpop;
  }
  const h = sources.headerDpop;
  if (typeof h === 'string' && h.length > 0) return h;
  if (Array.isArray(h) && h[0]) return h[0];
  return undefined;
}
