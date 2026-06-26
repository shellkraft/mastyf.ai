# Archived dashboard panels

These components are **not mounted** by `DashboardClient.tsx`. Active features live in the enterprise workspace centers:

| Archived panel | Active replacement |
|----------------|-------------------|
| `ThreatDiscoveryPanel.tsx` | `SecurityOperationsCenter` → Threat Detection (sub-tabs) |
| `ProtectionWorkspace.tsx` | Security + Settings integrations |
| `ExecutiveOverviewPanel.tsx` | `ExecutiveDashboard.tsx` |
| `CostGovernancePanel.tsx` | `CostIntelligenceCenter.tsx` |
| `GovernanceCenter.tsx` | Policy / Compliance centers |
| `AnalyticsDashboardPanel.tsx` | Activity Center → Analytics tab |
| `EnterpriseAiPanel.tsx` / `AiLearningPanel.tsx` | SOC → AI Learning |

Do not add new features here — extend the mounted workspace components instead.
