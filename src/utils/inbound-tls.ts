import { readFileSync } from 'fs';

/** Load inbound TLS cert/key for proxy listeners (MASTYF_AI_TLS_CERT_PATH + MASTYF_AI_TLS_KEY_PATH). */
export function loadInboundTlsFromEnv(): { cert: Buffer; key: Buffer } | null {
  const certPath = process.env['MASTYF_AI_TLS_CERT_PATH'];
  const keyPath = process.env['MASTYF_AI_TLS_KEY_PATH'];
  if (!certPath || !keyPath) return null;
  return {
    cert: readFileSync(certPath),
    key: readFileSync(keyPath),
  };
}
