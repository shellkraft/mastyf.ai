'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, RefreshCw, Settings, Power, PowerOff, Globe, Terminal, TerminalSquare, Variable, X, Copy, Link2 } from 'lucide-react';
import {
  fetchServerRegistry,
  addMcpServer,
  removeMcpServer,
  updateMcpServer,
  type UiMcpServerConfig,
  type UnifiedFleetServer,
} from '@/lib/mastyf-ai-api';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { SkeletonCard } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';

type TransportType = 'stdio' | 'sse';

type EnvVar = { key: string; value: string };

type FormState = {
  name: string;
  command: string;
  args: string;
  transport: TransportType;
  url: string;
  env: EnvVar[];
  disabled: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  command: '',
  args: '',
  transport: 'stdio',
  url: '',
  env: [],
  disabled: false,
};

export function LiveMcpServersPanel() {
  const [uiServers, setUiServers] = useState<UiMcpServerConfig[]>([]);
  const [unified, setUnified] = useState<UnifiedFleetServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { uiServers: ui, unified: uni } = await fetchServerRegistry();
    setUiServers(ui);
    setUnified(uni ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setEditingName(null);
    setShowForm(true);
  };

  const openEditForm = (u: UiMcpServerConfig) => {
    setForm({
      name: u.name,
      command: u.command || '',
      args: (u.args || []).join(' '),
      transport: u.transport || 'stdio',
      url: u.url || '',
      env: Object.entries(u.env || {}).map(([k, v]) => ({ key: k, value: v })),
      disabled: u.disabled ?? false,
    });
    setEditingName(u.name);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    if (form.transport === 'stdio' && !form.command.trim()) return;
    if (form.transport !== 'stdio' && !form.url.trim()) return;

    setSaving(true);
    const envRecord: Record<string, string> = {};
    for (const e of form.env) {
      if (e.key.trim()) envRecord[e.key.trim()] = e.value;
    }

    if (editingName) {
      const result = await updateMcpServer(editingName, {
        command: form.command.trim() || undefined,
        args: form.args.split(' ').filter(Boolean),
        transport: form.transport,
        url: form.url.trim() || undefined,
        env: Object.keys(envRecord).length > 0 ? envRecord : undefined,
        disabled: form.disabled,
      });
      setSaving(false);
      if (result.ok) {
        toast(`Server "${form.name}" updated`, 'success');
        setShowForm(false);
        await load();
      } else {
        toast(result.error || 'Failed to update server', 'error');
      }
    } else {
      const result = await addMcpServer({
        name: form.name.trim(),
        command: form.command.trim(),
        args: form.args.split(' ').filter(Boolean),
        transport: form.transport,
        url: form.url.trim() || undefined,
        env: Object.keys(envRecord).length > 0 ? envRecord : undefined,
        disabled: form.disabled,
      });
      setSaving(false);
      if (result.ok) {
        const msg = result.localUrl
          ? `Server "${form.name}" added — ${result.localUrl}. Reload MCP in your IDE.`
          : `Server "${form.name}" added — run mastyf-ai start to activate Fleet Hub.`;
        toast(msg, 'success');
        setForm(EMPTY_FORM);
        setShowForm(false);
        await load();
      } else {
        toast(result.error || 'Failed to add server', 'error');
      }
    }
  };

  const handleRemove = async (name: string) => {
    const result = await removeMcpServer(name);
    if (result.ok) {
      toast(`Server "${name}" removed`, 'success');
      await load();
    } else {
      toast(result.error || 'Failed to remove server', 'error');
    }
  };

  const handleToggleDisabled = async (u: UiMcpServerConfig) => {
    const result = await updateMcpServer(u.name, { disabled: !u.disabled });
    if (result.ok) {
      await load();
    } else {
      toast(result.error || 'Failed to toggle server', 'error');
    }
  };

  const addEnvVar = () => setForm({ ...form, env: [...form.env, { key: '', value: '' }] });
  const removeEnvVar = (idx: number) => {
    const env = form.env.filter((_, i) => i !== idx);
    setForm({ ...form, env });
  };
  const updateEnvVar = (idx: number, field: 'key' | 'value', val: string) => {
    const env = form.env.map((e, i) => i === idx ? { ...e, [field]: val } : e);
    setForm({ ...form, env });
  };

  if (loading) return <div className="flex flex-col gap-1"><SkeletonCard rows={2} /><SkeletonCard rows={3} /><SkeletonCard rows={2} /></div>;

  const allServers: UnifiedFleetServer[] = unified.length > 0
    ? unified
    : uiServers.map((u) => ({
        name: u.name,
        transport: u.transport || 'stdio',
        source: 'ui',
        wrapped: false,
        status: 'unknown',
      }));

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast('Local URL copied', 'success');
    } catch {
      toast('Copy failed', 'error');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ margin: 0 }}>MCP Servers</h2>
          <p className="text-sm text-muted" style={{ margin: '4px 0 0' }}>
            {allServers.length} server{allServers.length !== 1 ? 's' : ''} · Fleet Hub assigns local URLs automatically
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => void load()} aria-label="Refresh">
            <RefreshCw size={14} />
          </Button>
          <Button variant="primary" size="sm" onClick={openAddForm}>
            <Plus size={14} /> Add Server
          </Button>
        </div>
      </div>

      {error ? <p className="status status-error">{error}</p> : null}

      {allServers.length === 0 && !showForm ? (
        <Card>
          <EmptyState
            icon={Terminal}
            title="No MCP servers configured"
            message="Add a server to start proxying MCP tool calls through Mastyf AI"
            action={{ label: 'Add your first server', onClick: openAddForm }}
          />
        </Card>
      ) : null}

      {/* Server List */}
      {allServers.length > 0 ? (
        <div className="flex flex-col gap-1">
          {allServers.map((s) => {
            const uiEntry = uiServers.find((u) => u.name === s.name);
            const disabled = uiEntry?.disabled ?? false;
            return (
              <div
                key={s.name}
                className="card flex items-center gap-3"
                style={{ opacity: disabled ? 0.5 : 1 }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-1" style={{ marginBottom: 2 }}>
                    <strong style={{ fontSize: 14 }}>{s.name}</strong>
                    {disabled ? <Badge variant="offline">Disabled</Badge> : null}
                    <Badge variant={s.status === 'running' ? 'success' : 'neutral'}>
                      {s.status === 'running' ? 'Running' : s.status || 'Unknown'}
                    </Badge>
                    <Badge variant="neutral">{s.source}</Badge>
                    <Badge variant="neutral">{s.transport.toUpperCase()}</Badge>
                  </div>
                  {s.localUrl ? (
                    <div className="flex items-center gap-1" style={{ marginTop: 4 }}>
                      <Link2 size={12} style={{ color: 'var(--text-muted)' }} />
                      <code className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.localUrl}</code>
                      <button type="button" className="btn-icon" onClick={() => void copyUrl(s.localUrl!)} title="Copy local URL">
                        <Copy size={12} />
                      </button>
                    </div>
                  ) : null}
                  {s.metrics ? (
                    <p className="text-xs text-muted" style={{ margin: '4px 0 0' }}>
                      {s.metrics.totalCalls} calls · {s.metrics.blocked} blocked
                    </p>
                  ) : null}
                </div>
                {uiEntry ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => handleToggleDisabled(uiEntry)}
                    aria-label={disabled ? 'Enable server' : 'Disable server'}
                    title={disabled ? 'Enable' : 'Disable'}
                  >
                    {disabled ? <PowerOff size={14} /> : <Power size={14} />}
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => openEditForm(uiEntry)}
                    aria-label={`Edit ${s.name}`}
                    title="Edit"
                  >
                    <Settings size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => handleRemove(s.name)}
                    aria-label={`Remove ${s.name}`}
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Add/Edit Drawer */}
      {showForm ? (
          <div className="drawer-overlay" onClick={() => setShowForm(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
              {editingName ? `Edit Server: ${editingName}` : 'Add MCP Server'}
            </h3>

            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Server name
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="my-database"
                  disabled={!!editingName}
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                Transport
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`flex-1 flex items-center justify-center gap-1 cursor-pointer ${form.transport === 'stdio' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'var(--font-sans)' }}
                    onClick={() => setForm({ ...form, transport: 'stdio' })}
                  >
                    <TerminalSquare size={14} /> STDIO
                  </button>
                  <button
                    type="button"
                    className={`flex-1 flex items-center justify-center gap-1 cursor-pointer ${form.transport === 'sse' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'var(--font-sans)' }}
                    onClick={() => setForm({ ...form, transport: 'sse' })}
                  >
                    <Globe size={14} /> SSE / HTTP
                  </button>
                </div>
              </label>

              {form.transport === 'stdio' ? (
                <>
                  <label className="flex flex-col gap-1 text-sm">
                    Command
                    <input
                      className="input"
                      value={form.command}
                      onChange={(e) => setForm({ ...form, command: e.target.value })}
                      placeholder="npx, node, uvx, python..."
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    Arguments
                    <input
                      className="input"
                      value={form.args}
                      onChange={(e) => setForm({ ...form, args: e.target.value })}
                      placeholder="-y @modelcontextprotocol/server-memory"
                    />
                  </label>
                </>
              ) : (
                <label className="flex flex-col gap-1 text-sm">
                  Server URL
                  <input
                    className="input"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="http://localhost:3001/mcp"
                  />
                </label>
              )}

              {/* Environment Variables */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                <div className="flex items-center gap-1" style={{ marginBottom: 8 }}>
                  <Variable size={14} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Environment Variables</span>
                    <button
                        type="button"
                        className="btn-ghost btn-sm"
                    onClick={addEnvVar}
                    style={{ marginLeft: 'auto' }}
                  >
                    + Add variable
                  </button>
                </div>
                {form.env.length === 0 ? (
                  <p className="text-xs text-muted" style={{ margin: 0 }}>No environment variables</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {form.env.map((env, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <input
                          className="input mono"
                          value={env.key}
                          onChange={(e) => updateEnvVar(i, 'key', e.target.value)}
                          placeholder="KEY"
                          style={{ flex: 1, fontSize: 12 }}
                        />
                        <input
                          className="input mono"
                          value={env.value}
                          onChange={(e) => updateEnvVar(i, 'value', e.target.value)}
                          placeholder="value"
                          style={{ flex: 2, fontSize: 12 }}
                        />
                        <button
                          type="button"
                          className="btn-icon"
                          onClick={() => removeEnvVar(i)}
                          aria-label="Remove variable"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center gap-1 text-sm" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.disabled}
                  onChange={(e) => setForm({ ...form, disabled: e.target.checked })}
                />
                Disabled (server won't start automatically)
              </label>
            </div>

            <div className="flex justify-end gap-1" style={{ marginTop: 16 }}>
              <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button
                variant="primary" size="sm"
                loading={saving}
                disabled={
                  !form.name.trim()
                  || (form.transport === 'stdio' && !form.command.trim())
                  || (form.transport !== 'stdio' && !form.url.trim())
                }
                onClick={() => void handleSubmit()}
              >
                {editingName ? 'Save Changes' : 'Add Server'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Card style={{ marginTop: 16 }}>
        <p className="text-sm text-muted" style={{ margin: 0 }}>
          <strong>How it works:</strong> Servers added here are saved to{' '}
          Persisted to{' '}
          <code className="mono" style={{ fontSize: 12 }}>~/.mastyf-ai/servers.json</code>.
          Run <code className="mono" style={{ fontSize: 12 }}>mastyf-ai start</code> (Fleet Hub) to protect all servers with one command.
          Use <strong>STDIO</strong> for local servers (e.g., npx, uvx) and{' '}
          <strong>SSE / HTTP</strong> for remote servers (e.g., running on another port).
        </p>
      </Card>
    </div>
  );
}
