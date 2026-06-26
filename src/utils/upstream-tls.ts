export type UpstreamTlsCheckResult =
  | { ok: true }
  | { ok: false; message: string };

export function isPlaintextUpstreamAllowed(): boolean {
  if (process.env['MASTYF_AI_STRICT_MODE'] === 'true') {
    return false;
  }
  return process.env['MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM'] === 'true';
}

/** Reject http:// upstream unless dev-only plaintext flag is set (never in strict mode). */
export function assertUpstreamTlsAllowed(targetUrl: string): UpstreamTlsCheckResult {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return { ok: false, message: 'Invalid upstream URL' };
  }
  if (parsed.protocol === 'http:' && !isPlaintextUpstreamAllowed()) {
    return {
      ok: false,
      message:
        'Plaintext HTTP upstream is disabled. Use https:// or set MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM=true (dev only; blocked when MASTYF_AI_STRICT_MODE=true).',
    };
  }
  return { ok: true };
}
