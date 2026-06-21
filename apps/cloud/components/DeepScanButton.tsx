'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  packageName: string;
  enabled: boolean;
  currentTier: 'static' | 'live';
  source: 'computed' | 'attested';
};

export function DeepScanButton({ packageName, enabled, currentTier, source }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (currentTier === 'live' && source === 'computed') return null;

  async function runDeepScan() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/deep-scan/${encodeURIComponent(packageName)}`,
        { method: 'POST' },
      );
      const body = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(body.message || body.error || `Deep scan failed (${res.status})`);
        return;
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Deep scan failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="deep-scan-block">
      <button
        type="button"
        className="socket-search-btn"
        onClick={() => void runDeepScan()}
        disabled={!enabled || loading}
      >
        {loading ? 'Running deep scan…' : 'Run deep scan'}
      </button>
      <p className="certified-meta" style={{ marginTop: '0.5rem' }}>
        {enabled
          ? 'Starts the MCP server via npx and probes tools — may take up to 60s.'
          : 'Deep scan is available when running the cloud app locally (localhost).'}
      </p>
      {error ? (
        <p role="alert" className="certified-error" style={{ marginTop: '0.5rem' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
