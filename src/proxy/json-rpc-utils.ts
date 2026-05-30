/**
 * JSON-RPC 2.0 helpers for proxy error responses.
 */

/** True when the request expects a JSON-RPC response (id may be 0). */
export function hasJsonRpcId(id: unknown): id is string | number {
  return id !== undefined && id !== null;
}

export function jsonRpcErrorBody(
  id: string | number | undefined | null,
  code: number,
  message: string,
  data?: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    jsonrpc: '2.0',
    error: { code, message, ...(data ? { data } : {}) },
  };
  if (hasJsonRpcId(id)) {
    body.id = id;
  }
  return body;
}
