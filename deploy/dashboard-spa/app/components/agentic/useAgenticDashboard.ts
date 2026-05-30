'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchAgenticDashboard, type AgenticDashboardResponse } from '@/lib/guardian-api';
import { useDashboardWindow } from '../dashboard/DashboardWindowContext';

export function useAgenticDashboard(refreshKey = 0, pollMs = 0) {
  const { window: timeWindow } = useDashboardWindow();
  const [data, setData] = useState<AgenticDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const summary = await fetchAgenticDashboard(timeWindow);
    if (!summary) {
      setError('Could not reach agentic dashboard API — is Guardian proxy running on port 4000?');
      setData(null);
    } else {
      setError(summary.emptyReason ?? summary.error ?? null);
      setData(summary);
    }
    setLoading(false);
  }, [timeWindow]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!pollMs) return;
    const t = globalThis.setInterval(() => void load(), pollMs);
    return () => globalThis.clearInterval(t);
  }, [load, pollMs]);

  return { data, loading, error, reload: load, timeWindow };
}
