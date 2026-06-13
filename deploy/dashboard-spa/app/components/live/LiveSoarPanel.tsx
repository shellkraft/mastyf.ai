'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchSoarPlaybooks, type SoarPlaybook } from '@/lib/mastyff-ai-api';

export function LiveSoarPanel() {
  const [enabled, setEnabled] = useState(false);
  const [playbooks, setPlaybooks] = useState<SoarPlaybook[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchSoarPlaybooks();
    if (data) {
      setEnabled(data.enabled);
      setPlaybooks(data.playbooks);
    } else {
      setPlaybooks([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="hint">Loading SOAR playbooks…</p>;
  if (playbooks.length === 0) {
    return (
      <p className="muted">
        No playbooks loaded. Set <code>MASTYFF_AI_SOAR_PLAYBOOKS=true</code> and configure{' '}
        <code>config/soar-playbooks.json</code>.
      </p>
    );
  }

  return (
    <section>
      <p className="hint">
        SOAR {enabled ? 'enabled' : 'disabled (defaults shown)'} · {playbooks.length} playbook(s) from live config
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Triggers</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {playbooks.map((p) => (
            <tr key={p.id}>
              <td>
                <strong>{p.name}</strong>
                {p.description ? <div className="hint">{p.description}</div> : null}
              </td>
              <td>{(p.triggers ?? []).join(', ') || '—'}</td>
              <td>{(p.actions ?? []).join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
