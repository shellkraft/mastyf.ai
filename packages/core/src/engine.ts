import type {
  ToolDefinition, ToolScanResult, ScanStatus, Issue, ServerScanResult
} from "./types.js";
import { runRegexScan } from "./regex-scanner.js";
import { runSchemaScan } from "./schema-scanner.js";
import { runSemanticScan, type SemanticScanOptions } from "./semantic-scanner.js";
import { tryAcquireSemanticSlot, releaseSemanticSlot, semanticQueueMax, semanticPerTenantMax } from "./semantic-queue.js";
import { isCoreSemanticCircuitOpen } from "./semantic-circuit-breaker.js";
import { isCoreLocalSemanticEnabled, runLocalSemanticFallback } from "./local-semantic-fallback.js";
import { runArgumentScan } from "./argument-scanner.js";

export interface ScanEngineOptions {
  /** TR39 confusables before offline regex (default: true). */
  unicodeStrict?: boolean;
  semantic?: SemanticScanOptions & {
    // Run semantic only if regex/schema already fired (default: false for full coverage)
    onlyOnHits?: boolean;
    // Minimum confidence to report a semantic issue (default: 0.7)
    confidenceThreshold?: number;
  };
  /** Optional tenant id for per-tenant semantic queue caps */
  tenantId?: string;
  // Skip layers entirely
  skipRegex?: boolean;
  skipSchema?: boolean;
  skipSemantic?: boolean;
}

function computeStatus(issues: Issue[]): ScanStatus {
  if (issues.some(i => i.severity === "critical")) return "critical";
  if (issues.some(i => i.severity === "warning")) return "warning";
  return "clean";
}

const REGEX_TO_SEMANTIC_CATEGORY: Record<string, string> = {
  "cross-tool": "cross-tool-chaining",
  "privilege-escalation": "privilege-escalation",
  "exfiltration": "exfiltration",
  "stealth": "stealth",
  "injection": "prompt-injection",
  "shell": "shell-injection",
  "ssrf": "ssrf",
  "path": "path-traversal",
};

function deduplicateIssues(issues: Issue[]): Issue[] {
  const semanticCategories = new Set(
    issues.filter((i) => i.layer === "semantic").map((i) => i.category),
  );
  return issues.filter((i) => {
    if (i.layer !== "regex" && i.layer !== "schema") return true;
    const mapped = REGEX_TO_SEMANTIC_CATEGORY[i.category] ?? i.category;
    return !semanticCategories.has(mapped);
  });
}

const DEFAULT_MAX_TOOLS_PER_SCAN = 200;

function scanConcurrency(): number {
  const n = parseInt(process.env["MASTYFF_AI_SCAN_CONCURRENCY"] || "32", 10);
  return Number.isFinite(n) && n > 0 ? n : 32;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function scanTool(
  tool: ToolDefinition,
  options: ScanEngineOptions = {}
): Promise<ToolScanResult> {
  const confidenceThreshold = options.semantic?.confidenceThreshold ?? 0.7;
  const onlyOnHits = options.semantic?.onlyOnHits ?? false;

  let regexIssues: Issue[] = [];
  let schemaIssues: Issue[] = [];
  let semanticIssues: Issue[] = [];

  const timings = {
    regex: { ran: false, durationMs: 0 },
    schema: { ran: false, durationMs: 0 },
    semantic: { ran: false, durationMs: 0, skipped: undefined as string | undefined },
  };

  // ── LAYERS 1+2: REGEX + SCHEMA (parallel when both run) ─────────────────────
  const runRegex = !options.skipRegex;
  const runSchema = !options.skipSchema && Boolean(tool.inputSchema);

  if (runRegex && runSchema) {
    const t0 = performance.now();
    const [regex, schema] = await Promise.all([
      Promise.resolve(runRegexScan(tool, { unicodeStrict: options.unicodeStrict })),
      Promise.resolve(runSchemaScan(tool)),
    ]);
    regexIssues = regex;
    schemaIssues = schema;
    const elapsed = Math.round(performance.now() - t0);
    timings.regex = { ran: true, durationMs: elapsed };
    timings.schema = { ran: true, durationMs: elapsed };
  } else {
    if (runRegex) {
      const t0 = performance.now();
      regexIssues = runRegexScan(tool, { unicodeStrict: options.unicodeStrict });
      timings.regex = { ran: true, durationMs: Math.round(performance.now() - t0) };
    }
    if (runSchema) {
      const t0 = performance.now();
      schemaIssues = runSchemaScan(tool);
      timings.schema = { ran: true, durationMs: Math.round(performance.now() - t0) };
    }
  }

  // ── LAYER 3: SEMANTIC ───────────────────────────────────────────────────────
  const priorHits = [...regexIssues, ...schemaIssues]
    .filter(i => i.severity !== "info");

  const shouldRunSemantic = !options.skipSemantic && (
    !onlyOnHits || priorHits.length > 0
  );

  if (shouldRunSemantic) {
    if (isCoreSemanticCircuitOpen()) {
      const t0 = performance.now();
      if (isCoreLocalSemanticEnabled()) {
        semanticIssues = runLocalSemanticFallback(tool).filter(
          (i) => i.layer !== "semantic" || i.confidence >= confidenceThreshold,
        );
      }
      timings.semantic = {
        ran: semanticIssues.length > 0,
        durationMs: Math.round(performance.now() - t0),
        skipped: "circuit open — local fallback",
      };
    } else if (!tryAcquireSemanticSlot(options.tenantId)) {
      const cap = options.tenantId
        ? `per-tenant cap (${semanticPerTenantMax()})`
        : `global queue cap (${semanticQueueMax()})`;
      timings.semantic = {
        ran: false,
        durationMs: 0,
        skipped: cap,
      };
    } else {
      try {
        const t0 = performance.now();
        const rawSemantic = await runSemanticScan(
          tool,
          priorHits,
          options.semantic ?? {}
        );
        const skipMeta = rawSemantic.find((i) => i.category === "configuration" || i.category === "error");
        if (skipMeta && skipMeta.layer === "semantic") {
          timings.semantic = {
            ran: false,
            durationMs: Math.round(performance.now() - t0),
            skipped: skipMeta.message,
          };
          semanticIssues = rawSemantic.filter((i) => i.category !== "configuration" && i.category !== "error");
        } else {
          semanticIssues = rawSemantic.filter(
            i => i.layer !== "semantic" || i.confidence >= confidenceThreshold
          );
          timings.semantic = { ran: true, durationMs: Math.round(performance.now() - t0), skipped: undefined };
        }
      } finally {
        releaseSemanticSlot(options.tenantId);
      }
    }
  } else if (options.skipSemantic) {
    timings.semantic = { ran: false, durationMs: 0, skipped: "explicitly disabled" };
  } else {
    timings.semantic = { ran: false, durationMs: 0, skipped: "no regex/schema hits (onlyOnHits=true)" };
  }

  const allIssues = deduplicateIssues([
    ...regexIssues, ...schemaIssues, ...semanticIssues
  ]);

  return {
    toolName: tool.name,
    status: computeStatus(allIssues),
    issues: allIssues,
    layers: timings,
  };
}

export interface ToolCallScanResult extends ToolScanResult {
  argumentIssues: Issue[];
}

/**
 * Full tool-call evaluation — scans both the tool definition (descriptions,
 * schemas, semantics) AND runtime arguments for SQL/NoSQL injection,
 * boundary evasion, credential leaks, and shell obfuscation.
 *
 * Use scanTool() for server registration-time scanning (definitions only).
 * Use scanToolCall() for runtime call-time evaluation (definitions + args).
 */
export async function scanToolCall(
  tool: ToolDefinition,
  args?: Record<string, unknown>,
  options: ScanEngineOptions = {},
): Promise<ToolCallScanResult> {
  // ── Definition scan (existing layers) ────────────────────────────
  const defResult = await scanTool(tool, options);

  // ── Argument scan (NEW layer) ─────────────────────────────────────
  let argumentIssues: Issue[] = [];
  if (args && !options.skipRegex) {
    const argResult = runArgumentScan(args, tool.name);
    argumentIssues = argResult.issues;
  }

  // Merge argument issues into the full issue list
  const allIssues = deduplicateIssues([
    ...defResult.issues,
    ...argumentIssues,
  ]);

  return {
    ...defResult,
    status: computeStatus(allIssues),
    issues: allIssues,
    argumentIssues,
  };
}

export { runArgumentScan } from "./argument-scanner.js";

export async function scanServer(
  serverName: string,
  tools: ToolDefinition[],
  transport: "stdio" | "http" | "sse" = "stdio",
  options: ScanEngineOptions = {}
): Promise<ServerScanResult> {
  const capped = tools.slice(0, DEFAULT_MAX_TOOLS_PER_SCAN);
  const toolResults = await mapWithConcurrency(
    capped,
    scanConcurrency(),
    (tool) => scanTool(tool, options),
  );

  const summary = {
    total: toolResults.length,
    clean: toolResults.filter(r => r.status === "clean").length,
    warnings: toolResults.filter(r => r.status === "warning").length,
    critical: toolResults.filter(r => r.status === "critical").length,
  };

  const serverStatus =
    summary.critical > 0 ? "critical" :
    summary.warnings > 0 ? "warning" : "clean";

  return {
    serverName,
    transport,
    scannedAt: new Date().toISOString(),
    status: serverStatus,
    tools: toolResults,
    summary,
  };
}