const SECRET_KEY_PATTERN = /(api[_-]?key|secret|token|password|authorization)/i;

/** Redact likely secret fields before logging config objects. */
export function redactSecrets<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length >= 12 && /^(sk-|sk_ant|Bearer\s)/i.test(value)) {
      return '[REDACTED]' as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactSecrets(v)) as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(k) && typeof v === 'string' && v.length > 0) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out as T;
  }
  return value;
}
