'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTribunalStatus,
  runTribunalBatch,
  type TribunalJobStatus,
  type TribunalReport,
  type TribunalStatusResponse,
} from '@/lib/mastyf-ai-api';
import { TRIBUNAL_BATCH_LIMIT } from '@/lib/tribunal-config';

const POLL_MS = 2000;

export function useTribunalBatch(limit: number = TRIBUNAL_BATCH_LIMIT, refreshKey = 0) {
  const [status, setStatus] = useState<TribunalStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetchTribunalStatus(limit);
    if (!res) {
      setError('Failed to load tribunal status');
      setStatus(null);
    } else {
      setError('');
      setStatus(res);
    }
    setLoading(false);
    return res;
  }, [limit]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey]);

  const job = status?.job ?? null;
  const report = status?.report ?? null;
  const queue = status?.queue ?? null;
  const running = job?.state === 'running' || starting;

  useEffect(() => {
    if (!running) {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current != null) return;
    pollRef.current = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [running, refresh]);

  const start = useCallback(async () => {
    if (running) return { ok: false, error: 'Tribunal batch already running' };
    setStarting(true);
    try {
      const res = await runTribunalBatch(limit);
      if (res.ok) {
        await refresh();
      }
      return res;
    } finally {
      setStarting(false);
    }
  }, [limit, refresh, running]);

  return {
    job,
    report,
    queue,
    loading,
    error,
    running,
    refresh,
    start,
  };
}

export type { TribunalJobStatus, TribunalReport, TribunalStatusResponse };
