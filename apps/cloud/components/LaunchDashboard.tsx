'use client';

import { useEffect, useState } from 'react';

function isValidMastyffAiUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null') return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function LaunchDashboard() {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mastyffAiUrl, setMastyffAiUrl] = useState(
    typeof window !== 'undefined'
      ? localStorage.getItem('mastyff-ai-url') ?? 'http://localhost:4000'
      : 'http://localhost:4000',
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onLaunch = async () => {
    setError('');
    if (!isValidMastyffAiUrl(mastyffAiUrl)) {
      setError('Enter a valid http:// or https:// Mastyff AI URL.');
      return;
    }
    setLoading(true);
    try {
      const normalized = mastyffAiUrl.trim();
      localStorage.setItem('mastyff-ai-url', normalized);
      const res = await fetch('/api/dashboard/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mastyffAiUrl: normalized }),
      });
      const data = (await res.json()) as { redirectUrl?: string; error?: string };
      const redirectUrl = data.redirectUrl?.trim();
      if (!res.ok || !redirectUrl || !isValidMastyffAiUrl(redirectUrl)) {
        throw new Error(data.error ?? 'Launch failed');
      }
      window.location.href = redirectUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch failed');
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Open live dashboard (SSO)</h2>
      <p className="muted">
        One-time redirect to your Mastyff AI ops UI. Requires the env block above on that host (
        <code>MASTYFF_AI_CLOUD_JWT_SECRET</code> must match cloud <code>AUTH_SECRET</code>).
      </p>
      <label style={{ display: 'block', marginTop: '1rem' }}>
        Mastyff AI base URL
        <input
          type="url"
          value={mastyffAiUrl}
          onChange={(e) => setMastyffAiUrl(e.target.value)}
          placeholder="http://localhost:4000"
          style={{
            display: 'block',
            width: '100%',
            marginTop: '0.35rem',
            padding: '0.5rem',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: '#0a0e13',
            color: 'var(--text)',
          }}
        />
      </label>
      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: '1rem' }}
        onClick={() => void onLaunch()}
        disabled={loading}
      >
        {loading ? 'Redirecting…' : 'Open live dashboard (SSO)'}
      </button>
      {error && (
        <p className="alert alert-warn" style={{ marginTop: '1rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}
