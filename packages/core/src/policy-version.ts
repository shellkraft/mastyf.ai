/** Policy version stamp for LLM cache invalidation (M-007). */
let policyVersion = process.env["MASTYF_AI_POLICY_VERSION"]?.trim() || "default";

export function getPolicyVersionForCache(): string {
  return policyVersion;
}

export function setPolicyVersionForCache(version: string): void {
  policyVersion = version.trim() || "default";
  process.env["MASTYF_AI_POLICY_VERSION"] = policyVersion;
}

/** @internal */
export function resetPolicyVersionForTests(): void {
  policyVersion = "default";
  delete process.env["MASTYF_AI_POLICY_VERSION"];
}
