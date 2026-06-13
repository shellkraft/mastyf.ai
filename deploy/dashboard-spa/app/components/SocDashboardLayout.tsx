'use client';

import type { ReactNode } from 'react';
import { RefreshCw, Shield } from 'lucide-react';
import { resolveApiBase } from '@/lib/mastyff-ai-api';
import type { DashboardTabId, NavGroup } from '@/lib/dashboard-nav';
import { TAB_LABELS } from '@/lib/dashboard-nav';

type Props = {
  navGroups: NavGroup[];
  activeId: DashboardTabId;
  onNavigate: (id: DashboardTabId) => void;
  title?: string;
  topbarExtra?: ReactNode;
  children: ReactNode;
  wsConnected: boolean;
  wsEventCount: number;
  proxyOnline: boolean | null;
  liveBlocked: number | null;
  liveTotal: number | null;
  fallbackBlocked: number;
  fallbackTotal: number;
  onRefresh?: () => void;
  time?: string;
};

export function SocDashboardLayout({
  navGroups,
  activeId,
  onNavigate,
  title,
  topbarExtra,
  children,
  wsConnected,
  wsEventCount,
  proxyOnline,
  liveBlocked,
  liveTotal,
  fallbackBlocked,
  fallbackTotal,
  onRefresh,
  time,
}: Props) {
  const proxyStatus =
    proxyOnline === true
      ? { label: 'PROXY LIVE', color: 'status-ok', dot: true }
      : proxyOnline === false
        ? { label: 'PROXY OFFLINE — degraded', color: 'status-warn', dot: false }
        : { label: 'CONNECTING…', color: 'status-warn', dot: false };

  const displayTotal = liveTotal ?? fallbackTotal;
  const displayBlocked = liveBlocked ?? fallbackBlocked;
  const pageTitle = title ?? TAB_LABELS[activeId];

  return (
    <div className="soc-root">
      <div className="scan-line" />

      <aside className="soc-sidebar">
        <div className="soc-logo">
          <div className="soc-logo-mark">
            <div className="soc-logo-icon">
              <Shield size={18} />
            </div>
            <span className="soc-logo-title">MCP MastyffAi</span>
          </div>
          <div className="soc-logo-sub">SOC · LIVE OPERATIONS</div>
        </div>

        <nav className="soc-nav" aria-label="Dashboard sections">
          {navGroups.map((group) => (
            <div key={group.section}>
              <div className="soc-nav-section">{group.section}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`soc-nav-item ${activeId === item.id ? 'active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="soc-sidebar-footer">
          <div>
            {wsConnected ? (
              <>
                <span className="soc-live-dot" />
                WS LIVE · {wsEventCount} events
              </>
            ) : (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: 'var(--red)',
                    marginRight: 6,
                  }}
                />
                WS OFFLINE
              </>
            )}
          </div>
          <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-faint)' }}>
            {proxyOnline === true
              ? `Proxy: ${resolveApiBase() || 'localhost:4000'}`
              : proxyOnline === false
                ? 'Proxy offline — repo fallbacks'
                : 'Connecting to proxy…'}
          </div>
        </div>
      </aside>

      <div className="soc-main">
        <div className="soc-topbar">
          <div className="topbar-title">{pageTitle}</div>
          <span className={`topbar-badge ${proxyStatus.color}`}>
            {proxyStatus.dot && <span className="soc-live-dot" />}
            {proxyStatus.label}
          </span>
          <span
            className="topbar-badge status-ok"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}
          >
            {displayBlocked.toLocaleString()} blocked / {displayTotal.toLocaleString()} total
          </span>
          {time ? <span className="topbar-time">{time}</span> : null}
          {onRefresh ? (
            <button
              type="button"
              className="soc-topbar-refresh"
              onClick={onRefresh}
              aria-label="Refresh dashboard"
            >
              <RefreshCw size={14} color="var(--text-faint)" />
            </button>
          ) : null}
          {topbarExtra}
        </div>

        <div className="soc-content">{children}</div>
      </div>
    </div>
  );
}
