'use client';

import { useState, type ReactNode } from 'react';
import { Menu, RefreshCw } from 'lucide-react';
import type { WorkspaceId, WorkspaceNavItem } from '@/lib/workspace-nav';
import { WORKSPACE_LABELS } from '@/lib/workspace-nav';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

type ConnectionState = 'live' | 'degraded' | 'offline' | 'connecting';

type Props = {
  workspaces: WorkspaceNavItem[];
  activeWorkspace: WorkspaceId;
  onNavigate: (id: WorkspaceId) => void;
  topbarExtra?: ReactNode;
  children: ReactNode;
  connection: ConnectionState;
  wsConnected: boolean;
  wsEventCount: number;
  liveBlocked: number | null;
  liveTotal: number | null;
  onRefresh?: () => void;
  onDownloadReport?: () => void;
  reportLoading?: boolean;
};

function connectionTone(c: ConnectionState): 'live' | 'degraded' | 'offline' | 'neutral' {
  if (c === 'live') return 'live';
  if (c === 'degraded') return 'degraded';
  if (c === 'offline') return 'offline';
  return 'neutral';
}

function connectionLabel(c: ConnectionState): string {
  if (c === 'live') return 'Live';
  if (c === 'degraded') return 'Degraded';
  if (c === 'offline') return 'Offline';
  return 'Connecting';
}

export function EnterpriseLayout({
  workspaces,
  activeWorkspace,
  onNavigate,
  topbarExtra,
  children,
  connection,
  wsConnected,
  wsEventCount,
  liveBlocked,
  liveTotal,
  onRefresh,
  onDownloadReport,
  reportLoading,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const showMetrics = connection === 'live' && liveBlocked != null && liveTotal != null;

  return (
    <div className="enterprise-app">
      <div
        className={mobileOpen ? 'enterprise-sidebar-backdrop open' : 'enterprise-sidebar-backdrop'}
        onClick={() => setMobileOpen(false)}
        aria-hidden={!mobileOpen}
      />
      <aside className={mobileOpen ? 'enterprise-sidebar open' : 'enterprise-sidebar'}>
        <div className="enterprise-brand">
          <div className="enterprise-brand-title">MCP MastyffAi</div>
          <div className="enterprise-brand-sub">Agentic infrastructure</div>
        </div>
        <nav className="enterprise-nav" aria-label="Workspaces">
          {workspaces.map((w) => (
            <button
              key={w.id}
              type="button"
              className={activeWorkspace === w.id ? 'enterprise-nav-item active' : 'enterprise-nav-item'}
              aria-current={activeWorkspace === w.id ? 'page' : undefined}
              onClick={() => {
                onNavigate(w.id);
                setMobileOpen(false);
              }}
            >
              <span className="nav-icon">{w.icon}</span>
              <span>{w.label}</span>
            </button>
          ))}
        </nav>
        <div className="enterprise-sidebar-foot">
          {wsConnected ? `WebSocket · ${wsEventCount} events` : 'WebSocket offline'}
        </div>
      </aside>

      <div className="enterprise-main">
        <header className="enterprise-topbar">
          <Button
            variant="ghost"
            size="sm"
            className="enterprise-mobile-toggle"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </Button>
          <h1 className="enterprise-topbar-title">{WORKSPACE_LABELS[activeWorkspace]}</h1>
          <Badge tone={connectionTone(connection)}>{connectionLabel(connection)}</Badge>
          {showMetrics ? (
            <span className="status" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              {liveBlocked.toLocaleString()} blocked / {liveTotal.toLocaleString()} calls
            </span>
          ) : connection === 'offline' ? (
            <span className="status">Metrics unavailable offline</span>
          ) : null}
          <div className="enterprise-topbar-actions">
            {onDownloadReport ? (
              <Button variant="primary" size="sm" disabled={reportLoading} onClick={onDownloadReport}>
                {reportLoading ? 'Preparing…' : 'Download health report'}
              </Button>
            ) : null}
            {onRefresh ? (
              <Button variant="ghost" size="sm" onClick={onRefresh} aria-label="Refresh">
                <RefreshCw size={14} />
              </Button>
            ) : null}
            {topbarExtra}
          </div>
        </header>
        <div className="enterprise-content">
          <div className="enterprise-canvas">{children}</div>
        </div>
      </div>
    </div>
  );
}
