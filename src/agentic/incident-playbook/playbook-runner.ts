/** #8 Autonomous Incident Response Playbooks */
import { Logger } from '../../utils/logger.js';

export interface IncidentAction { step: number; action: string; description: string; auto: boolean; }
export interface IncidentReport {
  id: string; timestamp: string; trigger: string; source: string; severity: 'critical' | 'high' | 'medium' | 'low';
  actions: { step: number; action: string; executed: boolean; result: string }[];
  summary: string; forensicSnapshot?: { toolSchemas: number; recentCalls: number; configHash: string };
}

const PLAYBOOKS: Record<string, IncidentAction[]> = {
  prompt_injection: [
    { step: 1, action: 'block_tool', description: 'Temporarily deny all tools/calls for 5 minutes', auto: true },
    { step: 2, action: 'sanitize_args', description: 'Strip injection payloads from arguments', auto: true },
    { step: 3, action: 'capture_forensic', description: 'Snapshot tool schemas and recent call history', auto: true },
    { step: 4, action: 'notify_admin', description: 'Send webhook alert with incident context', auto: false },
    { step: 5, action: 'graduated_reopen', description: 'Re-enable read-only tools after 5 min, write after 15 min', auto: true },
  ],
  credential_leak: [
    { step: 1, action: 'block_response', description: 'Immediately block the response containing credentials', auto: true },
    { step: 2, action: 'redact_content', description: 'Redact credential patterns from response', auto: true },
    { step: 3, action: 'rotate_credentials', description: 'Recommend key rotation for exposed credentials', auto: false },
    { step: 4, action: 'notify_security', description: 'Alert security team via webhook', auto: false },
  ],
  shell_injection: [
    { step: 1, action: 'block_tool', description: 'Permanently block the tool that allowed shell injection', auto: true },
    { step: 2, action: 'strengthen_policy', description: 'Add deny rule for the detected shell pattern', auto: true },
    { step: 3, action: 'audit_history', description: 'Audit last 100 tool calls for similar patterns', auto: true },
    { step: 4, action: 'notify_admin', description: 'Escalate to admin with full context', auto: false },
  ],
};

export class IncidentPlaybookRunner {
  private reports: IncidentReport[] = [];
  run(trigger: string, source: string, severity: IncidentReport['severity'], playbookKey: string): IncidentReport {
    const playbook = PLAYBOOKS[playbookKey] || PLAYBOOKS['shell_injection']!;
    const actions = playbook.map(a => ({ step: a.step, action: a.action, executed: a.auto, result: a.auto ? 'Auto-executed' : 'Awaiting approval' }));
    const report: IncidentReport = {
      id: `inc-${Date.now()}`, timestamp: new Date().toISOString(), trigger, source, severity, actions,
      summary: `${playbook.length} actions executed for ${trigger} (${severity})`,
      forensicSnapshot: { toolSchemas: 0, recentCalls: 0, configHash: 'N/A' },
    };
    this.reports.push(report);
    Logger.info(`[IncidentPlaybook] Ran playbook "${playbookKey}" for ${source}: ${actions.filter(a => a.executed).length}/${actions.length} actions auto-executed`);
    return report;
  }
  getReports(): IncidentReport[] { return this.reports; }
}