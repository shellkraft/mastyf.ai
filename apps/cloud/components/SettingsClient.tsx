'use client';

import { useState } from 'react';

export function SettingsClient({ orgName }: { orgName: string }) {
  const [rotating, setRotating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [error, setError] = useState('');

  const onRotate = async () => {
    if (!confirm('Rotate API key? The previous key will stop working immediately.')) return;
    setRotating(true);
    setError('');
    setNewKey(null);
    try {
      const res = await fetch('/api/v1/keys/rotate', { method: 'POST' });
      const data = (await res.json()) as { apiKey?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Rotation failed');
      setNewKey(data.apiKey ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rotation failed');
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="card">
      <h2>Organization</h2>
      <p>
        Name: <strong>{orgName}</strong>
      </p>

      <h2 style={{ marginTop: '1.5rem' }}>API keys</h2>
      <p className="muted">
        Use this key as <code>DASHBOARD_API_KEY</code> on your self-hosted Mastyff AI and for{' '}
        <code>/api/v1/*</code> automation. Keys are shown only once when created or rotated.
      </p>
      <button type="button" className="btn btn-primary" onClick={onRotate} disabled={rotating}>
        {rotating ? 'Rotating…' : 'Rotate API key'}
      </button>
      {newKey && (
        <div className="alert alert-success" style={{ marginTop: '1rem' }}>
          <strong>New API key (copy now):</strong>
          <pre className="env-block" style={{ marginTop: '0.5rem' }}>
            {newKey}
          </pre>
        </div>
      )}
      {error && <p className="alert alert-warn">{error}</p>}
    </div>
  );
}
