'use client';

import { useCallback, useEffect, useState } from 'react';
import { Cloud, Database, Shield, Activity } from 'lucide-react';
import {
  fetchSetupStatus,
  saveSetupMastyffAiConfig,
  type SetupStatusResponse,
} from '@/lib/mastyff-ai-api';
import { CloudControlPlaneModal } from './CloudControlPlaneModal';
import { Button } from '../ui/Button';

type Props = {
  onGoToAgentFlow?: () => void;
  onAction?: (msg: string) => void;
};

export function SetupChecklistPanel({ onGoToAgentFlow, onAction }: Props) {
  const [status, setStatus] = useState<SetupStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [upstreamUrl, setUpstreamUrl] = useState('');
  const [listenPort, setListenPort] = useState('8443');
  const [authToken, setAuthToken] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const st = await fetchSetupStatus();
    setStatus(st);
    if (st?.mastyffAiConfig) {
      setUpstreamUrl(st.mastyffAiConfig.upstreamUrl || '');
      setListenPort(String(st.mastyffAiConfig.listenPort ?? 8443));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaveConfig = async () => {
    setSaving(true);
    const res = await saveSetupMastyffAiConfig({
      upstreamUrl,
      listenPort: parseInt(listenPort, 10) || 8443,
      authToken: authToken || undefined,
    });
    setSaving(false);
    if (res.ok) {
      onAction?.('Mastyff AI config saved');
      setConfigOpen(false);
      await load();
    } else {
      onAction?.(res.error || 'Save failed');
    }
  };

  const completed = status?.completedCount ?? 0;
  const total = status?.totalSteps ?? 3;
  const cloudConnected = status?.cloud?.connected;

  return (
    <section className="setup-checklist-section" aria-label="Setup checklist">
      <h2>Up and Running in Minutes</h2>
      <p className="setup-lead">Guided setup with cloud control plane integration.</p>

      <div className="setup-checklist-card">
        <header className="setup-checklist-head">
          <Shield size={22} className="setup-checklist-icon" aria-hidden />
          <div>
            <strong>Setup Checklist</strong>
            <span className="hint">
              {completed}/{total} completed
            </span>
          </div>
          {cloudConnected ? (
            <span className="setup-cloud-pill connected">
              <Cloud size={14} aria-hidden />
              Connected
            </span>
          ) : null}
        </header>
        <div
          className="setup-progress-bar"
          style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={total}
        />

        <ol className="setup-checklist-items">
          <li className={status?.mastyffAiConfig?.done ? 'done' : ''}>
            <span className="setup-check-icon" aria-hidden>
              {status?.mastyffAiConfig?.done ? '✓' : ''}
            </span>
            <div className="setup-check-body">
              <button
                type="button"
                className="setup-check-title linkish"
                onClick={() => setConfigOpen((o) => !o)}
              >
                Mastyff AI Config
              </button>
              <p className="hint">Configure mastyff-ai proxy settings</p>
              {configOpen ? (
                <div className="setup-config-form">
                  <label>
                    Upstream URL
                    <input
                      type="url"
                      value={upstreamUrl}
                      onChange={(e) => setUpstreamUrl(e.target.value)}
                    />
                  </label>
                  <label>
                    Listen Port
                    <input
                      type="number"
                      value={listenPort}
                      onChange={(e) => setListenPort(e.target.value)}
                    />
                  </label>
                  <label>
                    Auth Token
                    <input
                      type="password"
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      placeholder={
                        status?.mastyffAiConfig?.authTokenPreview || 'grd_sk_live_…'
                      }
                    />
                  </label>
                  <Button variant="primary" onClick={() => void onSaveConfig()} disabled={saving}>
                    Save Configuration
                  </Button>
                </div>
              ) : null}
            </div>
          </li>

          <li className={status?.database?.done ? 'done' : ''}>
            <span className="setup-check-icon" aria-hidden>
              {status?.database?.done ? '✓' : ''}
            </span>
            <div className="setup-check-body">
              <strong>Database Connectivity</strong>
              <p className="hint">
                {status?.database?.done
                  ? status.database.version
                  : status?.database?.error || 'Auto-detect database connection'}
              </p>
            </div>
            <Database size={18} className="setup-check-trail" aria-hidden />
          </li>

          <li className={status?.proxyTraffic?.done ? 'done' : ''}>
            <span className="setup-check-icon" aria-hidden>
              {status?.proxyTraffic?.done ? '✓' : ''}
            </span>
            <div className="setup-check-body">
              <strong>Proxy Traffic</strong>
              <p className="hint">
                {status?.proxyTraffic?.healthy
                  ? `Healthy — ${status.proxyTraffic.totalCalls?.toLocaleString()} requests routed`
                  : 'Waiting for traffic…'}
              </p>
            </div>
            <Activity size={18} className="setup-check-trail" aria-hidden />
          </li>
        </ol>

        <Button
          variant="primary"
          className="setup-cloud-btn"
          onClick={() => (cloudConnected ? undefined : setCloudOpen(true))}
          disabled={!!cloudConnected}
        >
          <Cloud size={18} aria-hidden />
          {cloudConnected ? 'Cloud Connected' : 'Connect to Cloud'}
        </Button>
      </div>

      <details className="setup-advanced">
        <summary>Advanced — CLI onboarding</summary>
        {status?.onboarding ? (
          <>
            <pre className="code-block setup-cmd">{status.onboarding.commands.onboard}</pre>
            <pre className="code-block setup-cmd">{status.onboarding.commands.dashboardProxy}</pre>
            {onGoToAgentFlow ? (
              <Button variant="secondary" onClick={onGoToAgentFlow}>
                Open Agent flow
              </Button>
            ) : null}
          </>
        ) : null}
      </details>

      {loading ? <p className="hint">Loading setup status…</p> : null}

      <CloudControlPlaneModal
        open={cloudOpen}
        onClose={() => setCloudOpen(false)}
        onConnected={() => void load()}
        onAction={onAction}
      />
    </section>
  );
}
