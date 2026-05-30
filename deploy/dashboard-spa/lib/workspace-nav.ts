import type { ReactNode } from 'react';
import { createElement } from 'react';
import {
  Activity,
  BookOpen,
  Bot,
  Home,
  Settings,
  Shield,
  ShieldAlert,
  Wallet,
} from 'lucide-react';

export type WorkspaceId =
  | 'home'
  | 'activity'
  | 'threats'
  | 'security'
  | 'agentic'
  | 'operations'
  | 'settings'
  | 'help';

export type ThreatsView =
  | 'overview'
  | 'threat-lab'
  | 'auto-research'
  | 'intel';

export type SecurityView = 'overview' | 'policy' | 'enterprise-ai' | 'ai-copilot' | 'quarantined-intel';

export type OperationsView =
  | 'analytics'
  | 'overview'
  | 'cost'
  | 'health'
  | 'fleet'
  | 'swarm';

export type AgenticView =
  | 'overview'
  | 'trust'
  | 'threats'
  | 'policy'
  | 'operations'
  | 'audit'
  | 'tools';

export type SettingsView = 'setup' | 'mcp-servers' | 'admin';

export type ActivityView = 'analysis' | 'audit';

export type HelpTopicId = string;

export type WorkspaceNavItem = {
  id: WorkspaceId;
  label: string;
  icon: ReactNode;
  description?: string;
};

const icon = (C: typeof Home, size = 18) => createElement(C, { size });

export const WORKSPACES: WorkspaceNavItem[] = [
  { id: 'home', label: 'Protection', icon: icon(Home), description: 'Autopilot status, digests, and health report' },
  { id: 'agentic', label: 'Agentic AI', icon: icon(Bot), description: 'Autonomous policy generation, threat prediction, compliance, red team, honeypots, and trust negotiation' },
  {
    id: 'activity',
    label: 'Activity',
    icon: icon(Activity),
    description: 'Security analysis pipeline and live audit',
  },
  {
    id: 'threats',
    label: 'Threats',
    icon: icon(ShieldAlert),
    description: 'Threat Lab, auto research, intel',
  },
  { id: 'security', label: 'Security', icon: icon(Shield), description: 'Posture, policy, AI copilot' },
  { id: 'operations', label: 'Operations', icon: icon(Wallet), description: 'Cost, fleet, charts' },
  { id: 'settings', label: 'Settings', icon: icon(Settings), description: 'Setup and admin' },
  { id: 'help', label: 'Help', icon: icon(BookOpen), description: 'Feature guide' },
];

export const WORKSPACE_LABELS: Record<WorkspaceId, string> = {
  home: 'Protection',
  agentic: 'Agentic AI',
  activity: 'Activity',
  threats: 'Threats',
  security: 'Security',
  operations: 'Operations',
  settings: 'Settings',
  help: 'Help',
};

export const DEFAULT_WORKSPACE: WorkspaceId = 'home';

const VALID = new Set<string>(Object.keys(WORKSPACE_LABELS));

/** Legacy ?tab= → workspace + view */
export const LEGACY_TAB_MAP: Record<string, { workspace: WorkspaceId; view?: string }> = {
  flow: { workspace: 'activity', view: 'analysis' },
  analysis: { workspace: 'activity', view: 'analysis' },
  audit: { workspace: 'activity', view: 'audit' },
  overview: { workspace: 'home' },
  readiness: { workspace: 'home' },
  'threat-discovery': { workspace: 'threats', view: 'overview' },
  threats: { workspace: 'threats', view: 'overview' },
  automation: { workspace: 'threats', view: 'overview' },
  architecture: { workspace: 'threats', view: 'overview' },
  'threat-intel': { workspace: 'threats', view: 'intel' },
  policy: { workspace: 'security', view: 'policy' },
  compliance: { workspace: 'security', view: 'overview' },
  soar: { workspace: 'security', view: 'overview' },
  simulations: { workspace: 'threats', view: 'overview' },
  'ai-hub': { workspace: 'security', view: 'enterprise-ai' },
  ai: { workspace: 'security', view: 'ai-copilot' },
  'enterprise-ai': { workspace: 'security', view: 'enterprise-ai' },
  'quarantined-intel': { workspace: 'security', view: 'quarantined-intel' },
  security: { workspace: 'security', view: 'overview' },
  'cost-health': { workspace: 'operations', view: 'analytics' },
  analytics: { workspace: 'operations', view: 'analytics' },
  'advanced-analytics': { workspace: 'operations', view: 'overview' },
  advanced: { workspace: 'operations', view: 'overview' },
  cost: { workspace: 'operations', view: 'cost' },
  health: { workspace: 'operations', view: 'health' },
  fleet: { workspace: 'operations', view: 'fleet' },
  benchmarks: { workspace: 'operations', view: 'overview' },
  swarm: { workspace: 'operations', view: 'swarm' },
  agentic: { workspace: 'agentic', view: 'overview' },
  'agentic-overview': { workspace: 'agentic', view: 'overview' },
  'agentic-trust': { workspace: 'agentic', view: 'trust' },
  'agentic-threats': { workspace: 'agentic', view: 'threats' },
  'agentic-policy': { workspace: 'agentic', view: 'policy' },
  'agentic-operations': { workspace: 'agentic', view: 'operations' },
  'agentic-audit': { workspace: 'agentic', view: 'audit' },
  'agentic-tools': { workspace: 'agentic', view: 'tools' },
  'setup-admin': { workspace: 'settings', view: 'setup' },
  setup: { workspace: 'settings', view: 'setup' },
  'mcp-servers': { workspace: 'settings', view: 'mcp-servers' },
  admin: { workspace: 'settings', view: 'admin' },
  help: { workspace: 'help' },
};

export type UrlNavState = {
  workspace: WorkspaceId;
  view?: string;
  topic?: string;
};

export function parseNavFromUrl(search: string): UrlNavState {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const workspaceParam = params.get('workspace');
  const view = params.get('view') ?? undefined;
  const topic = params.get('topic') ?? undefined;
  if (workspaceParam && VALID.has(workspaceParam)) {
    return { workspace: workspaceParam as WorkspaceId, view, topic };
  }
  const legacyTab = params.get('tab');
  if (legacyTab && LEGACY_TAB_MAP[legacyTab]) {
    const m = LEGACY_TAB_MAP[legacyTab];
    return { workspace: m.workspace, view: m.view ?? view, topic };
  }
  return { workspace: DEFAULT_WORKSPACE, view, topic };
}

export function syncNavToUrl(state: UrlNavState): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('workspace', state.workspace);
  if (state.view) url.searchParams.set('view', state.view);
  else url.searchParams.delete('view');
  if (state.topic) url.searchParams.set('topic', state.topic);
  else url.searchParams.delete('topic');
  url.searchParams.delete('tab');
  window.history.replaceState({}, '', url.toString());
}
