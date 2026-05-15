import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { Logger } from '../utils/logger.js';

export interface LearningOutcome {
  suggestionId: string;
  ruleName: string;
  source: 'baseline' | 'cost' | 'threat' | 'assist' | 'pattern';
  action: 'applied' | 'rejected' | 'modified' | 'ignored';
  confidence: number;
  timestamp: string;
  userFeedback?: string;
}

export interface LearningState {
  outcomes: LearningOutcome[];
  falsePositiveRate: number;
  truePositiveRate: number;
  adaptiveThreshold: number;
  moduleWeights: Record<string, number>;
  lastUpdated: string;
}

const DEFAULT_STATE: LearningState = {
  outcomes: [],
  falsePositiveRate: 0,
  truePositiveRate: 0,
  adaptiveThreshold: 0.85,
  moduleWeights: { baseline: 1.0, cost: 1.0, threat: 1.0, assist: 1.0 },
  lastUpdated: new Date().toISOString(),
};

/**
 * Self-Improvement Engine — reinforcement learning loop that tracks
 * which suggestions are accepted/rejected and adjusts: confidence scoring,
 * auto-apply thresholds, and module trust weights.
 */
export class SelfImprovement {
  private state: LearningState;
  private statePath: string;
  private sharedStore: any = null; // AuditTrailSync for PG-backed state

  constructor(statePath?: string, sharedStore?: any) {
    this.statePath = statePath || join(dirname(new URL(import.meta.url).pathname), '..', '..', '.ai-learning.json');
    this.sharedStore = sharedStore || null;
    this.state = this.loadState();
  }

  /** Enable shared PostgreSQL-backed learning state */
  setSharedStore(store: any): void {
    this.sharedStore = store;
    // Load existing shared outcomes
    this.loadSharedState().catch(() => {});
  }

  /** Load learning state from shared PG store */
  private async loadSharedState(): Promise<void> {
    if (!this.sharedStore?.getAggregatedMetrics) return;
    // Shared outcomes are loaded on-demand
  }

  private loadState(): LearningState {
    try {
      if (existsSync(this.statePath)) {
        const raw = readFileSync(this.statePath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_STATE,
          ...parsed,
          outcomes: Array.isArray(parsed.outcomes) ? parsed.outcomes.slice(-500) : [],
        };
      }
    } catch {
      Logger.info('[SelfImprovement] Starting with fresh learning state');
    }
    return { ...DEFAULT_STATE };
  }

  private saveState(): void {
    try {
      const dir = dirname(this.statePath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      this.state.lastUpdated = new Date().toISOString();
      writeFileSync(this.statePath, JSON.stringify(this.state, null, 2));
    } catch (err: any) {
      Logger.warn(`[SelfImprovement] Failed to save state: ${err?.message}`);
    }
  }

  /** Record a suggestion outcome */
  recordOutcome(outcome: LearningOutcome): void {
    this.state.outcomes.push(outcome);
    if (this.state.outcomes.length > 500) {
      this.state.outcomes = this.state.outcomes.slice(-500);
    }
    this.recomputeRates();
    this.saveState();
    Logger.info(`[SelfImprovement] Recorded: ${outcome.ruleName} → ${outcome.action} (source: ${outcome.source})`);
  }

  /** Recompute true/false positive rates from outcomes */
  private recomputeRates(): void {
    const recent = this.state.outcomes.slice(-100);
    if (recent.length < 5) return;

    const applied = recent.filter(o => o.action === 'applied').length;
    const rejected = recent.filter(o => o.action === 'rejected').length;
    const total = applied + rejected || 1;

    this.state.truePositiveRate = applied / total;
    this.state.falsePositiveRate = rejected / total;

    // Adjust threshold based on accuracy
    if (this.state.truePositiveRate > 0.9) {
      this.state.adaptiveThreshold = Math.max(0.5, this.state.adaptiveThreshold - 0.02);
    } else if (this.state.falsePositiveRate > 0.3) {
      this.state.adaptiveThreshold = Math.min(0.95, this.state.adaptiveThreshold + 0.05);
    }

    // Adjust per-module weights
    for (const source of ['baseline', 'cost', 'threat', 'assist'] as const) {
      const moduleOutcomes = recent.filter(o => o.source === source);
      if (moduleOutcomes.length >= 3) {
        const accepted = moduleOutcomes.filter(o => o.action === 'applied').length;
        const accuracy = accepted / moduleOutcomes.length;
        this.state.moduleWeights[source] = 0.5 + accuracy * 0.5;
      }
    }
  }

  /** Get adjusted confidence for a suggestion */
  adjustConfidence(rawConfidence: number, source: string): number {
    const weight = this.state.moduleWeights[source] || 1.0;
    return Math.min(rawConfidence * weight, 1.0);
  }

  /** Get current adaptive threshold for auto-apply */
  getAdaptiveThreshold(): number {
    return this.state.adaptiveThreshold;
  }

  /** Prune suggestions for ineffective rules (rules applied but with no impact) */
  suggestPruning(): string[] {
    const pruneList: string[] = [];
    const ruleCounts = new Map<string, { applied: number; rejected: number }>();

    for (const o of this.state.outcomes) {
      if (!ruleCounts.has(o.ruleName)) ruleCounts.set(o.ruleName, { applied: 0, rejected: 0 });
      const c = ruleCounts.get(o.ruleName)!;
      if (o.action === 'applied') c.applied++;
      if (o.action === 'rejected') c.rejected++;
    }

    for (const [ruleName, counts] of ruleCounts) {
      if (counts.rejected > counts.applied * 3 && counts.rejected >= 5) {
        pruneList.push(ruleName);
      }
    }

    return pruneList;
  }

  getState(): Readonly<LearningState> {
    return { ...this.state };
  }
}