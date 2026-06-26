'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchThreatDiscoveryStatus,
  type ThreatDiscoveryJobStatus,
  type ThreatDiscoveryStatus,
} from '@/lib/mastyf-ai-api';

const POLL_MS = 2000;

export function useThreatDiscoveryJobs(refreshKey = 0, externalTick = 0) {
  const [status, setStatus] = useState<ThreatDiscoveryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pollRef = useRef<number | null>(null);
  const prevRunningRef = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetchThreatDiscoveryStatus();
    setStatus(res.status);
    setError(res.error || '');
    setLoading(false);
    return res.status;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshKey, externalTick]);

  const threatLabJob = status?.jobs?.threatLab ?? null;
  const autoResearchJob = status?.jobs?.autoResearch ?? null;
  const threatLabRunning = threatLabJob?.state === 'running';
  const autoResearchRunning = autoResearchJob?.state === 'running';
  const anyRunning = threatLabRunning || autoResearchRunning;

  useEffect(() => {
    if (!anyRunning) {
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
  }, [anyRunning, refresh]);

  useEffect(() => {
    if (prevRunningRef.current && !anyRunning) {
      void refresh();
      const t1 = window.setTimeout(() => void refresh(), 1000);
      const t2 = window.setTimeout(() => void refresh(), 3000);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }
    prevRunningRef.current = anyRunning;
  }, [anyRunning, refresh]);

  const setOptimisticRunning = useCallback((kind: 'threat-lab' | 'auto-research', jobId?: string) => {
    const startedAt = new Date().toISOString();
    const optimistic: ThreatDiscoveryJobStatus = {
      jobId: jobId || '',
      kind,
      tenantId: 'default',
      state: 'running',
      phase: 'discover',
      phaseLabel: kind === 'threat-lab' ? 'Threat Lab discovery' : 'Auto threat research',
      progressPct: 10,
      startedAt,
      finishedAt: null,
      exitCode: null,
      error: null,
      logTail: '',
      pid: null,
    };
    setStatus((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        jobs: {
          ...prev.jobs,
          threatLab: kind === 'threat-lab' ? optimistic : prev.jobs.threatLab,
          autoResearch: kind === 'auto-research' ? optimistic : prev.jobs.autoResearch,
        },
      };
    });
  }, []);

  return {
    status,
    loading,
    error,
    refresh,
    threatLabJob,
    autoResearchJob,
    threatLabRunning,
    autoResearchRunning,
    anyRunning,
    setOptimisticRunning,
  };
}
