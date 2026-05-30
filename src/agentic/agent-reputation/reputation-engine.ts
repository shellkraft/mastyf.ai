/** #9 Agent Reputation & Behavior Scoring */
import { Logger } from '../../utils/logger.js';

export interface AgentReputation {
  agentId: string; score: number; tier: 'trusted' | 'standard' | 'suspicious' | 'blocked';
  totalCalls: number; blockedCalls: number; bypassRate: number; avgArgumentEntropy: number;
  toolDiversity: number; lastUpdated: string; trend: 'improving' | 'stable' | 'declining';
}
export class ReputationEngine {
  private agents = new Map<string, { total: number; blocked: number; tools: Set<string>; entropySamples: number[] }>();
  record(agentId: string, toolName: string, blocked: boolean, argLength: number): void {
    if (!this.agents.has(agentId)) this.agents.set(agentId, { total: 0, blocked: 0, tools: new Set(), entropySamples: [] });
    const a = this.agents.get(agentId)!; a.total++; if (blocked) a.blocked++; a.tools.add(toolName);
    a.entropySamples.push(argLength); if (a.entropySamples.length > 200) a.entropySamples = a.entropySamples.slice(-200);
  }
  getScore(agentId: string): AgentReputation {
    const a = this.agents.get(agentId);
    if (!a) return { agentId, score: 0.5, tier: 'standard', totalCalls: 0, blockedCalls: 0, bypassRate: 0, avgArgumentEntropy: 0, toolDiversity: 0, lastUpdated: new Date().toISOString(), trend: 'stable' };
    const bypassRate = a.total > 0 ? (a.total - a.blocked) / a.total : 1;
    const avgLen = a.entropySamples.length > 0 ? a.entropySamples.reduce((s, v) => s + v, 0) / a.entropySamples.length : 0;
    const entropyScore = Math.min(avgLen / 5000, 1);
    const blockPenalty = a.blocked / Math.max(a.total, 1);
    let score = 0.5 + (1 - blockPenalty) * 0.3 - entropyScore * 0.2;
    score = Math.max(0, Math.min(1, score));
    let tier: AgentReputation['tier'] = 'standard';
    if (score >= 0.8) tier = 'trusted';
    else if (score < 0.3) tier = 'suspicious';
    else if (a.blocked > 20 && bypassRate < 0.3) tier = 'blocked';
    return { agentId, score: Math.round(score * 100) / 100, tier, totalCalls: a.total, blockedCalls: a.blocked, bypassRate: Math.round(bypassRate * 100) / 100, avgArgumentEntropy: Math.round(avgLen), toolDiversity: a.tools.size, lastUpdated: new Date().toISOString(), trend: 'stable' };
  }
  getPolicyForAgent(agentId: string): { mode: 'strict' | 'standard' | 'relaxed'; message: string } {
    const rep = this.getScore(agentId);
    if (rep.tier === 'trusted') return { mode: 'relaxed', message: 'Trusted agent — standard policy' };
    if (rep.tier === 'suspicious' || rep.tier === 'blocked') return { mode: 'strict', message: `${rep.tier} agent — strict policy enforced (read-only, rate-limited)` };
    return { mode: 'standard', message: 'Standard policy applied' };
  }
}