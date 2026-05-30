import type { ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Eye,
  FileCode,
  GitBranch,
  LayoutDashboard,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { createElement } from 'react';

export type DashboardTabId =
  | 'flow'
  | 'audit'
  | 'overview'
  | 'threat-discovery'
  | 'threat-intel'
  | 'ai-hub'
  | 'policy'
  | 'compliance'
  | 'soar'
  | 'security'
  | 'cost-health'
  | 'fleet'
  | 'simulations'
  | 'benchmarks'
  | 'swarm'
  | 'setup-admin';

export type AiHubSubTab = 'ai' | 'enterprise-ai';
export type CostHealthSubTab = 'cost' | 'health' | 'readiness';
export type SetupAdminSubTab = 'setup' | 'mcp-servers' | 'admin';

export type NavItem = {
  id: DashboardTabId;
  label: string;
  icon: ReactNode;
  badge?: string;
};

export type NavGroup = {
  section: string;
  items: NavItem[];
};

const icon = (C: typeof Activity, size = 16) => createElement(C, { size });

export const NAV_GROUPS: NavGroup[] = [
  {
    section: 'Operations',
    items: [
      { id: 'flow', label: 'Agent flow', icon: icon(Activity) },
      { id: 'audit', label: 'Live audit', icon: icon(Shield) },
    ],
  },
  {
    section: 'Insights',
    items: [{ id: 'overview', label: 'Overview', icon: icon(LayoutDashboard) }],
  },
  {
    section: 'Threats',
    items: [
      { id: 'threat-discovery', label: 'Threat discovery', icon: icon(Eye), badge: '8' },
      { id: 'threat-intel', label: 'Threat intel', icon: icon(AlertTriangle), badge: '155' },
    ],
  },
  {
    section: 'AI',
    items: [{ id: 'ai-hub', label: 'AI & intel', icon: icon(Sparkles) }],
  },
  {
    section: 'Governance',
    items: [
      { id: 'policy', label: 'Policy', icon: icon(FileCode) },
      { id: 'compliance', label: 'Compliance', icon: icon(CheckCircle) },
      { id: 'soar', label: 'SOAR playbooks', icon: icon(GitBranch) },
    ],
  },
  {
    section: 'Platform',
    items: [
      { id: 'security', label: 'Security', icon: icon(ShieldAlert) },
      { id: 'cost-health', label: 'Cost & health', icon: icon(Wallet) },
      { id: 'fleet', label: 'Fleet', icon: icon(Users) },
    ],
  },
  {
    section: 'Research',
    items: [
      { id: 'simulations', label: 'Attack sims', icon: icon(Zap) },
      { id: 'swarm', label: 'Swarm analysis', icon: icon(TrendingUp) },
    ],
  },
  {
    section: 'Settings',
    items: [{ id: 'setup-admin', label: 'Setup & admin', icon: icon(Settings) }],
  },
];

export const TAB_LABELS: Record<DashboardTabId, string> = {
  flow: 'Agent flow',
  audit: 'Live audit',
  overview: 'Executive overview',
  'threat-discovery': 'Threat discovery',
  'threat-intel': 'Threat intelligence',
  'ai-hub': 'AI & enterprise intel',
  policy: 'Policy management',
  compliance: 'Compliance & controls',
  soar: 'SOAR playbooks',
  security: 'Security posture',
  'cost-health': 'Cost & health',
  fleet: 'Fleet overview',
  simulations: 'Attack simulations',
  benchmarks: 'Performance & benchmarks',
  swarm: 'Swarm analysis',
  'setup-admin': 'Setup & administration',
};

const VALID_TABS = new Set<string>(Object.keys(TAB_LABELS));

/** Legacy horizontal-tab IDs → merged sidebar destinations */
export const LEGACY_TAB_ALIASES: Record<string, DashboardTabId> = {
  setup: 'setup-admin',
  admin: 'setup-admin',
  'mcp-servers': 'setup-admin',
  ai: 'ai-hub',
  'enterprise-ai': 'ai-hub',
  cost: 'cost-health',
  health: 'cost-health',
  readiness: 'cost-health',
};

export function parseTabFromUrl(search: string): DashboardTabId | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const tab = params.get('tab');
  if (!tab) return null;
  if (VALID_TABS.has(tab)) return tab as DashboardTabId;
  return LEGACY_TAB_ALIASES[tab] ?? null;
}

export function parseLegacySubTab(search: string): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  return params.get('tab');
}

export function syncTabToUrl(tab: DashboardTabId): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState({}, '', url.toString());
}

export const DEFAULT_TAB: DashboardTabId = 'flow';
