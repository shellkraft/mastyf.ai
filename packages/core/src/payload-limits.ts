const DEFAULT_MAX_ARGUMENT_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_FIELD_BYTES = 64 * 1024;

/** Max serialized tool-call arguments bytes for core scanner (aligns with proxy payload guard). */
export function getMaxArgumentBytes(): number {
  const n = parseInt(process.env.MASTYF_AI_MAX_ARGUMENT_BYTES || '', 10);
  if (Number.isFinite(n) && n > 0) return n;
  const legacy = parseInt(process.env.MASTYF_AI_MAX_PAYLOAD_BYTES || '', 10);
  if (Number.isFinite(legacy) && legacy > 0) return legacy;
  return DEFAULT_MAX_ARGUMENT_BYTES;
}

/** Per-field string byte cap for argument scanner leaves (M-010). */
export function getMaxArgumentFieldBytes(): number {
  const n = parseInt(process.env.MASTYF_AI_MAX_ARGUMENT_FIELD_BYTES || '', 10);
  if (Number.isFinite(n) && n > 0) return n;
  return DEFAULT_MAX_FIELD_BYTES;
}

export function serializedArgumentBytes(args: Record<string, unknown>): number {
  try {
    return Buffer.byteLength(JSON.stringify(args), 'utf8');
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}
