/** Fail-closed semantic scanning when LLM layer is unavailable (enterprise / strict mode). */
export function isCoreSemanticStrictMode(): boolean {
  if (process.env.MASTYF_AI_CORE_SEMANTIC_FAIL_CLOSED === 'true') return true;
  return process.env.MASTYF_AI_SEMANTIC_STRICT === 'true';
}
