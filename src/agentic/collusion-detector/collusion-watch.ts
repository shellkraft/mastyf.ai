/** #5 Agent-to-Agent Collusion Detection */
import { Logger } from '../../utils/logger.js';

export interface CollusionAlert {
  alertId: string; pattern: 'recon_then_exploit' | 'coordinated_exfil' | 'token_share';
  agents: string[]; tools: string[]; confidence: number; timestamp: string; description: string;
}
export class CollusionDetector {
  private sessions = new Map<string, { agentId: string; tools: string[]; timestamps: number[] }[]>();
  private alerts: CollusionAlert[] = [];
  record(agentId: string, serverName: string, toolName: string): CollusionAlert | null {
    if (!this.sessions.has(serverName)) this.sessions.set(serverName, []);
    const serverSessions = this.sessions.get(serverName)!;
    let agent = serverSessions.find(s => s.agentId === agentId);
    if (!agent) { agent = { agentId, tools: [], timestamps: [] }; serverSessions.push(agent); }
    agent.tools.push(toolName); agent.timestamps.push(Date.now());
    if (agent.tools.length > 50) { agent.tools = agent.tools.slice(-50); agent.timestamps = agent.timestamps.slice(-50); }
    if (serverSessions.length >= 2) {
      const a1 = serverSessions[0]!; const a2 = serverSessions[1]!;
      if (a1.tools.includes('list_directory') && a2.tools.includes('read_file') && a1.timestamps[a1.tools.indexOf('list_directory')]! < a2.timestamps[a2.tools.indexOf('read_file')]!) {
        const alert: CollusionAlert = { alertId: `col-${Date.now()}`, pattern: 'recon_then_exploit', agents: [a1.agentId, a2.agentId], tools: ['list_directory', 'read_file'], confidence: 0.7, timestamp: new Date().toISOString(), description: `Agent ${a1.agentId} probed, agent ${a2.agentId} exploited within same server` };
        this.alerts.push(alert);
        Logger.warn(`[CollusionDetector] ${alert.description}`);
        return alert;
      }
    }
    return null;
  }
  getAlerts(): CollusionAlert[] { return this.alerts; }
}