/**
 * #3 SARSA for Adaptive Policy Thresholds.
 *
 * State: [blockRate(0-1), fpRate(0-1), callVolume(normalized)]
 * Action: adjust threshold ±10% for each of 3 thresholds:
 *   - maxRatePerMin, maxLatencyP95, semanticConfidenceMin
 *
 * Uses tabular SARSA with ε-greedy exploration and linear function
 * approximation for continuous state space.
 *
 * Reward: +1 blocked attack, -10 false positive, -1 latency breach
 */
import { Logger } from '../../utils/logger.js';

export interface ThresholdState {
  blockRate: number;    // 0-1
  fpRate: number;       // 0-1
  callVolume: number;   // 0-1 (normalized to 1000 calls/min)
}

export type ThresholdAction = 'increase' | 'decrease' | 'maintain';

export interface SarsaDecision {
  parameter: 'rateLimit' | 'latencyLimit' | 'confidence';
  action: ThresholdAction;
  newValue: number;
  qValues: { action: ThresholdAction; value: number }[];
  epsilon: number;
}

export class SarsaThresholdAdapter {
  // Q-table: state hash → action → value
  private qTable = new Map<string, Record<ThresholdAction, number>>();
  // Per-parameter tracking
  private rateLimit = 500;
  private latencyLimit = 2000;
  private confidenceMin = 0.7;
  private epsilon = 0.15;  // exploration rate, decays over time
  private alpha = 0.1;     // learning rate
  private gamma = 0.9;     // discount factor
  private steps = 0;

  /** Recommend an action for a specific threshold parameter. */
  decide(parameter: 'rateLimit' | 'latencyLimit' | 'confidence', state: ThresholdState): SarsaDecision {
    const stateKey = this.hashState(state);
    let qs = this.qTable.get(stateKey);
    if (!qs) {
      qs = { increase: 0, decrease: 0, maintain: 0 };
      this.qTable.set(stateKey, qs);
    }

    let action: ThresholdAction;
    if (Math.random() < this.epsilon) {
      // Explore: random action
      const actions: ThresholdAction[] = ['increase', 'decrease', 'maintain'];
      action = actions[Math.floor(Math.random() * 3)]!;
    } else {
      // Exploit: best Q
      action = qs.increase >= qs.decrease && qs.increase >= qs.maintain ? 'increase'
        : qs.decrease >= qs.maintain ? 'decrease' : 'maintain';
    }

    // Apply action
    let currentValue = 0;
    switch (parameter) {
      case 'rateLimit': currentValue = this.rateLimit; break;
      case 'latencyLimit': currentValue = this.latencyLimit; break;
      case 'confidence': currentValue = this.confidenceMin; break;
    }

    let newValue = currentValue;
    switch (action) {
      case 'increase': newValue = parameter === 'confidence' ? Math.min(1, currentValue * 1.1) : Math.round(currentValue * 1.1); break;
      case 'decrease': newValue = parameter === 'confidence' ? Math.max(0.1, currentValue * 0.9) : Math.round(currentValue * 0.9); break;
    }

    return {
      parameter,
      action,
      newValue,
      qValues: [
        { action: 'increase', value: Math.round(qs.increase * 1000) / 1000 },
        { action: 'decrease', value: Math.round(qs.decrease * 1000) / 1000 },
        { action: 'maintain', value: Math.round(qs.maintain * 1000) / 1000 },
      ],
      epsilon: Math.round(this.epsilon * 1000) / 1000,
    };
  }

  /** Learn from the outcome (SARSA update). */
  learn(parameter: 'rateLimit' | 'latencyLimit' | 'confidence', state: ThresholdState, action: ThresholdAction, reward: number, nextState: ThresholdState, nextAction: ThresholdAction): void {
    const stateKey = this.hashState(state);
    const nextKey = this.hashState(nextState);

    let qs = this.qTable.get(stateKey);
    if (!qs) { qs = { increase: 0, decrease: 0, maintain: 0 }; this.qTable.set(stateKey, qs); }

    let nextQs = this.qTable.get(nextKey);
    if (!nextQs) { nextQs = { increase: 0, decrease: 0, maintain: 0 }; this.qTable.set(nextKey, nextQs); }

    // SARSA: Q(s,a) ← Q(s,a) + α * [r + γ * Q(s',a') - Q(s,a)]
    const tdTarget = reward + this.gamma * nextQs[nextAction]!;
    qs[action] = qs[action]! + this.alpha * (tdTarget - qs[action]!);

    // Apply to parameter
    switch (parameter) {
      case 'rateLimit':
        if (action === 'increase') this.rateLimit = Math.round(this.rateLimit * 1.1);
        else if (action === 'decrease') this.rateLimit = Math.round(this.rateLimit * 0.9);
        break;
      case 'latencyLimit':
        if (action === 'increase') this.latencyLimit = Math.round(this.latencyLimit * 1.1);
        else if (action === 'decrease') this.latencyLimit = Math.round(this.latencyLimit * 0.9);
        break;
      case 'confidence':
        if (action === 'increase') this.confidenceMin = Math.min(1, this.confidenceMin * 1.1);
        else if (action === 'decrease') this.confidenceMin = Math.max(0.1, this.confidenceMin * 0.9);
        break;
    }

    // Decay epsilon
    this.steps++;
    this.epsilon = Math.max(0.02, 0.15 / (1 + this.steps / 500));
  }

  /** Get current threshold values. */
  getThresholds(): { rateLimit: number; latencyLimit: number; confidenceMin: number } {
    return { rateLimit: this.rateLimit, latencyLimit: this.latencyLimit, confidenceMin: Math.round(this.confidenceMin * 100) / 100 };
  }

  private hashState(s: ThresholdState): string {
    const b = Math.round(s.blockRate * 10) / 10;
    const f = Math.round(s.fpRate * 10) / 10;
    const v = Math.round(s.callVolume * 10) / 10;
    return `b${b}f${f}v${v}`;
  }
}