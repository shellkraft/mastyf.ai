/**
 * Shared pre-forward guards for tools/call across all proxy transports.
 */
import { agenticPreForwardToolCall } from './agentic-hooks-bridge.js';
import { checkExpandedPayload } from './payload-guard.js';
import { hasJsonRpcId, jsonRpcErrorBody } from './json-rpc-utils.js';

export type ToolCallPreGuardResult =
  | { blocked: false; arguments?: Record<string, unknown> }
  | { blocked: true; code: number; message: string };

export async function runToolCallPreForwardGuard(
  serverName: string,
  toolName: string,
  args: Record<string, unknown> | undefined,
  requestId: string,
): Promise<ToolCallPreGuardResult> {
  if (args !== undefined) {
    const expanded = checkExpandedPayload(args);
    if (!expanded.ok) {
      return {
        blocked: true,
        code: -32001,
        message: `Blocked by MCP Guardian: ${expanded.reason}`,
      };
    }
  }
  if (args) {
    const agentic = await agenticPreForwardToolCall(serverName, toolName, args, requestId);
    if (agentic.blocked) {
      return {
        blocked: true,
        code: -32001,
        message: `Blocked by MCP Guardian: ${agentic.reason || 'agentic policy'}`,
      };
    }
    return { blocked: false, arguments: agentic.sanitizedArgs ?? args };
  }
  return { blocked: false };
}

/** JSON-RPC error object for transports that return Record responses. */
export function toolCallGuardBlockResponse(
  id: unknown,
  guard: Extract<ToolCallPreGuardResult, { blocked: true }>,
): Record<string, unknown> {
  if (!hasJsonRpcId(id)) {
    return { jsonrpc: '2.0', error: { code: guard.code, message: guard.message } };
  }
  return jsonRpcErrorBody(id, guard.code, guard.message) as Record<string, unknown>;
}
