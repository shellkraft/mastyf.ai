import type { PolicyRule } from '../policy/policy-types.js';

export type AutopilotRolloutStage = 'shadow' | 'canary' | 'enforce';

export interface AutopilotProposalEvidence {
  simulationPassed: boolean;
  replayCoverage: number;
  confidence: number;
  predictedFalsePositiveDelta: number;
  predictedBypassDelta: number;
  blastRadiusPercent: number;
  rollbackConfidence: number;
  canarySizePercent: number;
}

export interface AutopilotProposal {
  suggestionId: string;
  rule: PolicyRule;
  source: 'baseline' | 'cost' | 'threat' | 'assist' | 'pattern' | 'attack';
  stage: AutopilotRolloutStage;
  evidence: AutopilotProposalEvidence;
}

export interface AutopilotSafetyThresholds {
  minReplayCoverage: number;
  minConfidence: number;
  maxFalsePositiveDelta: number;
  maxBypassDelta: number;
  maxBlastRadiusPercent: number;
  minRollbackConfidence: number;
  maxCanarySizePercent: number;
}

export interface AutopilotSafetyDecision {
  allowed: boolean;
  blockers: string[];
  warnings: string[];
  thresholds: AutopilotSafetyThresholds;
}

export const DEFAULT_AUTOPILOT_THRESHOLDS: AutopilotSafetyThresholds = {
  minReplayCoverage: 0.95,
  minConfidence: 0.75,
  maxFalsePositiveDelta: 0.02,
  maxBypassDelta: 0.0,
  maxBlastRadiusPercent: 0.15,
  minRollbackConfidence: 0.9,
  maxCanarySizePercent: 0.1,
};

export function loadAutopilotThresholds(): AutopilotSafetyThresholds {
  const envNum = (key: string, fallback: number): number => {
    const raw = process.env[key];
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    minReplayCoverage: envNum('MASTYFF_AI_AUTOPILOT_MIN_REPLAY_COVERAGE', DEFAULT_AUTOPILOT_THRESHOLDS.minReplayCoverage),
    minConfidence: envNum('MASTYFF_AI_AUTOPILOT_MIN_CONFIDENCE', DEFAULT_AUTOPILOT_THRESHOLDS.minConfidence),
    maxFalsePositiveDelta: envNum('MASTYFF_AI_AUTOPILOT_MAX_FP_DELTA', DEFAULT_AUTOPILOT_THRESHOLDS.maxFalsePositiveDelta),
    maxBypassDelta: envNum('MASTYFF_AI_AUTOPILOT_MAX_BYPASS_DELTA', DEFAULT_AUTOPILOT_THRESHOLDS.maxBypassDelta),
    maxBlastRadiusPercent: envNum('MASTYFF_AI_AUTOPILOT_MAX_BLAST_RADIUS', DEFAULT_AUTOPILOT_THRESHOLDS.maxBlastRadiusPercent),
    minRollbackConfidence: envNum('MASTYFF_AI_AUTOPILOT_MIN_ROLLBACK_CONFIDENCE', DEFAULT_AUTOPILOT_THRESHOLDS.minRollbackConfidence),
    maxCanarySizePercent: envNum('MASTYFF_AI_AUTOPILOT_MAX_CANARY_SIZE', DEFAULT_AUTOPILOT_THRESHOLDS.maxCanarySizePercent),
  };
}

export function evaluateAutopilotSafety(
  proposal: AutopilotProposal,
  thresholds: AutopilotSafetyThresholds = loadAutopilotThresholds(),
): AutopilotSafetyDecision {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const e = proposal.evidence;

  if (!e.simulationPassed) blockers.push('simulation failed');
  if (e.replayCoverage < thresholds.minReplayCoverage) {
    blockers.push(`replay coverage too low (${e.replayCoverage.toFixed(2)} < ${thresholds.minReplayCoverage.toFixed(2)})`);
  }
  if (e.confidence < thresholds.minConfidence) {
    blockers.push(`confidence too low (${e.confidence.toFixed(2)} < ${thresholds.minConfidence.toFixed(2)})`);
  }
  if (e.predictedFalsePositiveDelta > thresholds.maxFalsePositiveDelta) {
    blockers.push(
      `predicted false-positive delta too high (${e.predictedFalsePositiveDelta.toFixed(3)} > ${thresholds.maxFalsePositiveDelta.toFixed(3)})`,
    );
  }
  if (e.predictedBypassDelta > thresholds.maxBypassDelta) {
    blockers.push(
      `predicted bypass delta too high (${e.predictedBypassDelta.toFixed(3)} > ${thresholds.maxBypassDelta.toFixed(3)})`,
    );
  }
  if (e.blastRadiusPercent > thresholds.maxBlastRadiusPercent) {
    blockers.push(
      `blast radius too high (${e.blastRadiusPercent.toFixed(2)} > ${thresholds.maxBlastRadiusPercent.toFixed(2)})`,
    );
  }
  if (e.rollbackConfidence < thresholds.minRollbackConfidence) {
    blockers.push(
      `rollback confidence too low (${e.rollbackConfidence.toFixed(2)} < ${thresholds.minRollbackConfidence.toFixed(2)})`,
    );
  }
  if (proposal.stage === 'canary' && e.canarySizePercent > thresholds.maxCanarySizePercent) {
    blockers.push(
      `canary size too large (${e.canarySizePercent.toFixed(2)} > ${thresholds.maxCanarySizePercent.toFixed(2)})`,
    );
  }
  if (proposal.stage === 'enforce' && proposal.source !== 'threat' && e.confidence < 0.9) {
    warnings.push('enforce stage with non-threat source and confidence < 0.90');
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
    thresholds,
  };
}
