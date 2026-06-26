/** Optional hook for semantic scan duration observability (wired from server metrics on bootstrap). */
export type SemanticDurationHook = (phase: string, durationMs: number, outcome: string) => void;

let durationHook: SemanticDurationHook | null = null;

export function setSemanticScanDurationHook(hook: SemanticDurationHook | null): void {
  durationHook = hook;
}

export function reportSemanticScanDuration(phase: string, durationMs: number, outcome: string): void {
  durationHook?.(phase, durationMs, outcome);
}
