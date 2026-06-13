import type { ToolDefinition } from "../types.js";

export interface HttpServerConfig {
  url: string;                   // e.g. "https://api.example.com/mcp"
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export async function fetchToolsFromHttp(
  config: HttpServerConfig
): Promise<ToolDefinition[]> {
  const timeoutMs = config.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const initResponse = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.headers ?? {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "mastyff-ai", version: "2.3.4" },
        },
      }),
      signal: controller.signal,
    });

    if (!initResponse.ok) {
      throw new Error(`HTTP ${initResponse.status} on initialize`);
    }

    const listResponse = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.headers ?? {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 2, method: "tools/list", params: {},
      }),
      signal: controller.signal,
    });

    if (!listResponse.ok) {
      throw new Error(`HTTP ${listResponse.status} on tools/list`);
    }

    const data = await listResponse.json() as {
      result?: { tools?: ToolDefinition[] };
    };

    return data.result?.tools ?? [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchToolsFromSse(
  config: HttpServerConfig
): Promise<ToolDefinition[]> {
  const timeoutMs = config.timeoutMs ?? 15_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(config.url, {
        headers: {
          "Accept": "text/event-stream",
          ...(config.headers ?? {}),
        },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: HTTP ${response.status}`);
      }

      const tools: ToolDefinition[] = [];
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const msg = JSON.parse(line.slice(6));
              if (msg?.result?.tools) {
                tools.push(...msg.result.tools);
                clearTimeout(timeout);
                resolve(tools);
                return;
              }
            } catch { /* skip */ }
          }
        }
      }

      clearTimeout(timeout);
      resolve(tools);
    } catch (err) {
      clearTimeout(timeout);
      reject(err);
    }
  });
}