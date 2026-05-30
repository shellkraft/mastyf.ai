/**
 * #2 Contextual Bandit for Policy Rule Auto-Tuning.
 *
 * Selects which policy rules to enforce/relax/skip based on context
 * (server type, time of day, agent identity, historical accuracy).
 *
 * Uses LinUCB (Linear Upper Confidence Bound) — a classic contextual
 * bandit algorithm that balances exploration and exploitation using
 * confidence bounds on linear reward estimates.
 *
 * Reward model:
 *   +1   correctly blocked attack
 *   +0.5 correctly passed benign call
 *   -5   false positive (blocked benign)
 *   -10  false negative (bypass)
 */
import { Logger } from '../../utils/logger.js';

export type PolicyAction = 'enforce' | 'relax' | 'skip';

export interface BanditContext {
  serverType: string;     // e.g., "filesystem", "github", "shell"
  hourOfDay: number;      // 0-23
  agentTier: string;      // "trusted", "standard", "suspicious"
  ruleCategory: string;   // "shell_injection", "path_traversal", "prompt_injection"
}

interface ArmState {
  /** Dimensionality of context features */
  d: number;
  /** A matrix = D^T * D + I (ridge regression) */
  A: number[][];
  /** A inverse (computed lazily via rank-1 update) */
  AInv: number[][];
  /** b vector = D^T * rewards */
  b: number[];
  /** theta = AInv * b (estimated parameters) */
  theta: number[];
  /** Number of times this arm was pulled */
  pulls: number;
}

export interface BanditDecision {
  action: PolicyAction;
  confidence: number;
  expectedReward: number;
  upperBound: number;
  exploration: boolean;
  armStats: { action: PolicyAction; pulls: number; meanReward: number; ucb: number }[];
}

export class ContextualBanditPolicyTuner {
  private arms = new Map<PolicyAction, ArmState>();
  private readonly alpha = 1.0; // UCB exploration parameter
  private readonly contextDim = 5; // [serverType hash, hour/24, agentTier hash, ruleCat hash, bias]

  constructor() {
    for (const action of ['enforce', 'relax', 'skip'] as PolicyAction[]) {
      const d = this.contextDim;
      const A: number[][] = Array.from({ length: d }, (_, i) =>
        Array.from({ length: d }, (_, j) => (i === j ? 1 : 0)), // Identity
      );
      this.arms.set(action, {
        d,
        A,
        AInv: this.cloneMatrix(A),
        b: Array(d).fill(0),
        theta: Array(d).fill(0),
        pulls: 0,
      });
    }
  }

  /** Encode context into a feature vector. */
  private encodeContext(ctx: BanditContext): number[] {
    const serverHash = this.hashString(ctx.serverType) / 1e9;
    const tierHash = this.hashString(ctx.agentTier) / 1e9;
    const ruleHash = this.hashString(ctx.ruleCategory) / 1e9;
    return [
      serverHash,
      ctx.hourOfDay / 24,
      tierHash,
      ruleHash,
      1.0, // bias term
    ];
  }

  /** Select the best action given context. */
  selectAction(ctx: BanditContext): BanditDecision {
    const x = this.encodeContext(ctx);
    const stats: BanditDecision['armStats'] = [];

    let bestAction: PolicyAction = 'skip';
    let bestUCB = -Infinity;
    let bestReward = 0;

    for (const [action, arm] of this.arms) {
      // theta = AInv * b
      const theta = this.matVecMul(arm.AInv, arm.b);
      arm.theta = theta;

      // Predicted reward = theta^T * x
      const predictedReward = this.dot(theta, x);

      // UCB = sqrt(x^T * AInv * x)
      const xTAInv = this.matVecMul(arm.AInv, x);
      const ucbBonus = this.alpha * Math.sqrt(Math.abs(this.dot(x, xTAInv)) + 1e-6);

      const meanReward = arm.pulls > 0 ? predictedReward / Math.max(arm.pulls, 1) : 0;
      const ucbValue = predictedReward + ucbBonus;

      stats.push({ action, pulls: arm.pulls, meanReward: Math.round(predictedReward * 1000) / 1000, ucb: Math.round(ucbValue * 1000) / 1000 });

      if (ucbValue > bestUCB) {
        bestUCB = ucbValue;
        bestReward = predictedReward;
        bestAction = action;
      }
    }

    return {
      action: bestAction,
      confidence: Math.min(1, Math.max(0, bestReward)),
      expectedReward: Math.round(bestReward * 1000) / 1000,
      upperBound: Math.round(bestUCB * 1000) / 1000,
      exploration: stats.every(s => s.pulls < 5),
      armStats: stats,
    };
  }

  /** Update the bandit with a reward observation. */
  update(action: PolicyAction, ctx: BanditContext, reward: number): void {
    const arm = this.arms.get(action);
    if (!arm) return;

    const x = this.encodeContext(ctx);
    const d = arm.d;

    // Update A = A + x * x^T (outer product)
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        arm.A[i]![j]! += x[i]! * x[j]!;
      }
    }

    // Update b = b + reward * x
    for (let i = 0; i < d; i++) {
      arm.b[i]! += reward * x[i]!;
    }

    // Update AInv using Sherman-Morrison rank-1 update
    // A_new = A + xx^T  →  AInv_new = AInv - (AInv * x * x^T * AInv) / (1 + x^T * AInv * x)
    const Ax = this.matVecMul(arm.AInv, x);
    const xTAx = this.dot(x, Ax);
    const denom = 1 + xTAx;

    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        arm.AInv[i]![j]! -= (Ax[i]! * Ax[j]!) / denom;
      }
    }

    arm.pulls++;
  }

  private hashString(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = ((hash << 5) - hash) + s.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private dot(a: number[], b: number[]): number {
    return a.reduce((s, v, i) => s + v! * b[i]!, 0);
  }

  private matVecMul(A: number[][], x: number[]): number[] {
    return A.map(row => row.reduce((s, v, j) => s + v * x[j]!, 0));
  }

  private cloneMatrix(m: number[][]): number[][] {
    return m.map(r => [...r]);
  }
}