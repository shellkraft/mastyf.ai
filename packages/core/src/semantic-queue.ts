/** In-process cap for concurrent semantic scans (mirrors proxy async queue env). */
let inflight = 0;
const tenantInflight = new Map<string, number>();

export function semanticQueueMax(): number {
  const n = parseInt(
    process.env["MASTYFF_AI_SEMANTIC_ASYNC_MAX_QUEUE"] ||
      process.env["MASTYFF_AI_SEMANTIC_MAX_QUEUE"] ||
      "1000",
    10,
  );
  return Number.isFinite(n) && n > 0 ? n : 1000;
}

export function semanticPerTenantMax(): number {
  const n = parseInt(
    process.env["MASTYFF_AI_SEMANTIC_PER_TENANT_MAX"] ||
      process.env["MASTYFF_AI_SEMANTIC_PER_TENANT_MAX"] ||
      "50",
    10,
  );
  return Number.isFinite(n) && n > 0 ? n : 50;
}

export function tryAcquireSemanticSlot(tenantId?: string): boolean {
  if (inflight >= semanticQueueMax()) return false;
  const tid = tenantId?.trim();
  if (tid) {
    const cur = tenantInflight.get(tid) || 0;
    if (cur >= semanticPerTenantMax()) return false;
    tenantInflight.set(tid, cur + 1);
  }
  inflight += 1;
  return true;
}

export function releaseSemanticSlot(tenantId?: string): void {
  const tid = tenantId?.trim();
  if (tid) {
    const cur = tenantInflight.get(tid) || 0;
    if (cur <= 1) tenantInflight.delete(tid);
    else tenantInflight.set(tid, cur - 1);
  }
  if (inflight > 0) inflight -= 1;
}

/** @internal */
export function resetSemanticQueueForTests(): void {
  inflight = 0;
  tenantInflight.clear();
}
