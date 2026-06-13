export type ReadinessCheck = () => Promise<{ ok: boolean; detail?: string }>;

const checks: ReadinessCheck[] = [];

export function registerReadinessCheck(check: ReadinessCheck): void {
  checks.push(check);
}

export async function runReadinessChecks(): Promise<{ ready: boolean; checks: Record<string, string> }> {
  const results: Record<string, string> = {};
  let ready = true;

  for (let i = 0; i < checks.length; i++) {
    const name = `check_${i}`;
    try {
      const result = await checks[i]();
      results[name] = result.ok ? 'ok' : (result.detail || 'failed');
      if (!result.ok) ready = false;
    } catch (err: unknown) {
      results[name] = err instanceof Error ? err.message : 'error';
      ready = false;
    }
  }

  return { ready, checks: results };
}
