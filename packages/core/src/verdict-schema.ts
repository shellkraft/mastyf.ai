/**
 * Runtime validation for LLM semantic verdict JSON (M-006).
 */
import type { SemanticVerdict } from "./semantic-verdict-types.js";

const VALID_SEVERITIES = new Set(["critical", "warning", "none"]);

export function parseAndValidateVerdict(rawText: string): SemanticVerdict | null {
  const cleanJson = rawText.replace(/```(?:json)?\n?/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  if (typeof o.is_injection !== "boolean") return null;
  const confidence = typeof o.confidence === "number" ? o.confidence : Number(o.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) return null;
  const severity = typeof o.severity === "string" ? o.severity : "none";
  if (!VALID_SEVERITIES.has(severity)) return null;
  const categories = Array.isArray(o.categories)
    ? o.categories.filter((c): c is string => typeof c === "string")
    : [];
  const specific_phrases = Array.isArray(o.specific_phrases)
    ? o.specific_phrases.filter((c): c is string => typeof c === "string")
    : [];
  const reasoning = typeof o.reasoning === "string" ? o.reasoning : "";
  return {
    is_injection: o.is_injection,
    confidence,
    severity: severity as SemanticVerdict["severity"],
    categories,
    specific_phrases,
    reasoning,
  };
}
