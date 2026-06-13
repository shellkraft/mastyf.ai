import { spawn } from "node:child_process";
import type { ToolDefinition } from "../types.js";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface StdioServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  /** Overall timeout for the entire fetch operation (default: 30_000ms) */
  timeoutMs?: number;
  /** Time to wait after initialize before sending tools/list (default: 3000ms) */
  initWaitMs?: number;
  /** Time to wait after tools/list for the response (default: 5000ms) */
  toolsListWaitMs?: number;
  /** Number of retries on transient failures (default: 1) */
  maxRetries?: number;
}

export async function fetchToolsFromStdio(
  config: StdioServerConfig
): Promise<ToolDefinition[]> {
  const timeoutMs = config.timeoutMs ?? 30_000;
  const initWaitMs = config.initWaitMs ?? 3_000;
  const toolsListWaitMs = config.toolsListWaitMs ?? 5_000;
  const maxRetries = config.maxRetries ?? 1;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const tools = await attemptFetch(config, { timeoutMs, initWaitMs, toolsListWaitMs });
      return tools;
    } catch (err: any) {
      lastError = err;
      if (attempt < maxRetries) {
        // Brief backoff before retry
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch tools from ${config.command} after ${maxRetries + 1} attempts`);
}

async function attemptFetch(
  config: StdioServerConfig,
  timeouts: { timeoutMs: number; initWaitMs: number; toolsListWaitMs: number }
): Promise<ToolDefinition[]> {
  const { timeoutMs, initWaitMs, toolsListWaitMs } = timeouts;

  return new Promise((resolve, reject) => {
    const child = spawn(config.command, config.args ?? [], {
      env: { ...process.env, ...(config.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill();
        reject(new Error(`Stdio server timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", () => { /* discard stderr */ });

    child.on("error", (err) => {
      if (!settled) { settled = true; clearTimeout(timer); reject(err); }
    });

    // Wait for server to be ready, then send initialize + tools/list
    child.on("spawn", async () => {
      try {
        const send = (req: JsonRpcRequest) => {
          const line = JSON.stringify(req) + "\n";
          child.stdin.write(line);
        };

        // MCP handshake
        send({ jsonrpc: "2.0", id: 1, method: "initialize", params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "mastyff-ai", version: "2.3.4" },
        }});

        // Give server time to initialize (configurable, was fixed 2s)
        await new Promise(r => setTimeout(r, initWaitMs));

        send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });

        // Wait for response (configurable, was fixed 3s)
        await new Promise(r => setTimeout(r, toolsListWaitMs));

        child.kill();

        if (!settled) {
          settled = true;
          clearTimeout(timer);

          // Parse NDJSON from stdout
          const lines = stdout.split("\n").filter(Boolean);
          const tools: ToolDefinition[] = [];

          for (const line of lines) {
            try {
              const msg: JsonRpcResponse = JSON.parse(line);
              if (msg.id === 2 && msg.result) {
                const result = msg.result as { tools?: ToolDefinition[] };
                tools.push(...(result.tools ?? []));
              }
            } catch {
              // Skip non-JSON lines (startup messages, etc.)
            }
          }

          if (tools.length === 0) {
            reject(new Error(`No tools returned from ${config.command} — server may have failed to initialize`));
          } else {
            resolve(tools);
          }
        }
      } catch (err) {
        if (!settled) { settled = true; clearTimeout(timer); reject(err); }
      }
    });
  });
}
