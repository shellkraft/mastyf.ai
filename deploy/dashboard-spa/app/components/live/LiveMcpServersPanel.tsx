'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchServerRegistry, type ServerRegistryEntry } from '@/lib/mastyff-ai-api';

export function LiveMcpServersPanel() {
  const [servers, setServers] = useState<ServerRegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const list = await fetchServerRegistry();
    if (!list.length) {
      setServers([]);
      setError('Server registry empty — start proxy with DASHBOARD_ENABLED=true.');
    } else {
      setServers(list);
      setError('');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="hint">Loading MCP server registry…</p>;
  if (error) return <p className="status status-error">{error}</p>;
  if (servers.length === 0) {
    return (
      <p className="muted">
        No MCP servers registered yet. Add configs via Setup or point clients at the Mastyff AI proxy.
      </p>
    );
  }

  return (
    <section>
      <div className="btn-row">
        <button type="button" className="secondary btn-sm" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Server</th>
            <th>Transport</th>
            <th>Proxy</th>
            <th>Calls</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((s) => (
            <tr key={s.name}>
              <td>{s.name}</td>
              <td>{s.transport}</td>
              <td>{s.wrapped ? 'Wrapped' : 'Direct'}</td>
              <td>{s.metrics?.totalCalls ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
