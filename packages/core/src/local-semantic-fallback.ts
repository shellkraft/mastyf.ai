import type { Issue, ToolDefinition } from "./types.js";

const LOCAL_PATTERNS: { id: string; category: string; severity: "critical" | "warning"; weight: number; re: RegExp; message: string }[] = [
  { id: "MCPG-LOC-001", category: "prompt-injection", severity: "critical", weight: 0.85, re: /ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions/i, message: "Local heuristic: instruction override in tool description" },
  { id: "MCPG-LOC-002", category: "privilege-escalation", severity: "critical", weight: 0.8, re: /bypass\s+(?:security|safety|restrictions)/i, message: "Local heuristic: security bypass language" },
  { id: "MCPG-LOC-003", category: "exfiltration", severity: "critical", weight: 0.75, re: /send\s+(?:the\s+)?(?:result|data|output)\s+to/i, message: "Local heuristic: data exfiltration directive" },
  { id: "MCPG-LOC-004", category: "cross-tool-chaining", severity: "warning", weight: 0.7, re: /\bbefore\b[\s\S]{0,80}?\bthen\b/i, message: "Local heuristic: multi-step tool chain (before…then)" },
  { id: "MCPG-LOC-005", category: "cross-tool-chaining", severity: "warning", weight: 0.7, re: /\bfirst\b[\s\S]{0,80}?\bthen\b/i, message: "Local heuristic: multi-step tool chain (first…then)" },
  { id: "MCPG-LOC-005", category: "stealth", severity: "warning", weight: 0.65, re: /do\s+not\s+(?:tell|inform|mention)\s+(?:the\s+)?user/i, message: "Local heuristic: concealment directive" },
];

const THRESHOLD = parseFloat(
  process.env["MASTYFF_AI_LOCAL_SEMANTIC_THRESHOLD"] ||
    process.env["MASTYFF_AI_LOCAL_SEMANTIC_THRESHOLD"] ||
    "0.55",
);

export function isCoreLocalSemanticEnabled(): boolean {
  const v = process.env["MASTYFF_AI_LOCAL_SEMANTIC"] ?? process.env["MASTYFF_AI_LOCAL_SEMANTIC"];
  if (v === "false" || v === "0") return false;
  return true;
}

/** Deterministic heuristic when no LLM API key is configured. */
export function runLocalSemanticFallback(
  tool: ToolDefinition,
): Issue[] {
  const text = `${tool.name}\n${tool.description ?? ""}`;
  let score = 0;
  const hits: Issue[] = [];

  for (const p of LOCAL_PATTERNS) {
    const m = p.re.exec(text);
    if (m) {
      score += p.weight;
      hits.push({
        id: p.id,
        layer: "semantic",
        severity: p.severity,
        category: p.category,
        message: p.message,
        evidence: m[0].trim().slice(0, 80),
        confidence: p.weight,
      });
    }
  }

  if (score < THRESHOLD) return [];
  return hits.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}
