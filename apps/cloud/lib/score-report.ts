/**
 * Cloud-side score report types and parsing (mirrors src/agentic/trust-score/score-report.ts).
 */

export const SCORE_REPORT_CHECK_ID = 'mastyf-ai-score-report';

export type PublishableIssue = {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  plainEnglish: string;
  fixHint: string;
};

export type PublishableCategory = {
  name: string;
  score: number;
  weight: number;
  weightPercent: number;
  contributionPoints: number;
  findings: string[];
  plainEnglish: string;
};

export type ImprovementAction = {
  priority: 'immediate' | 'high' | 'medium' | 'low';
  category: string;
  action: string;
  expectedScoreIncrease: number;
  effort: 'hours' | 'days' | 'weeks';
};

export type PublishableScoreReport = {
  overallScore: number;
  grade: string;
  summaryPlainEnglish: string;
  categories: PublishableCategory[];
  improvementActions: ImprovementAction[];
  issues: PublishableIssue[];
};

export function parseScoreReportFromChecks(checks: unknown[]): PublishableScoreReport | null {
  const raw = checks.find(
    (c) =>
      typeof c === 'object'
      && c !== null
      && (c as { id?: string }).id === SCORE_REPORT_CHECK_ID,
  ) as PublishableScoreReport | undefined;
  if (!raw || typeof raw.overallScore !== 'number') return null;
  return raw;
}

export function certificationChecksOnly(checks: unknown[]): Array<{
  id?: string;
  name?: string;
  passed?: boolean;
  details?: string;
  score?: number;
  maxScore?: number;
}> {
  return checks.filter(
    (c) =>
      typeof c === 'object'
      && c !== null
      && (c as { id?: string }).id !== SCORE_REPORT_CHECK_ID,
  ) as Array<{
    id?: string;
    name?: string;
    passed?: boolean;
    details?: string;
    score?: number;
    maxScore?: number;
  }>;
}

/** Fallback report when legacy certs lack embedded score-report payload. */
export function buildLegacyScoreReport(
  score: number,
  grade: string,
  checks: Array<{ name?: string; passed?: boolean; details?: string; score?: number }>,
): PublishableScoreReport {
  const failed = checks.filter((c) => c.passed === false);
  const issues: PublishableIssue[] = failed.map((c) => ({
    severity: 'medium' as const,
    title: c.name || 'Check failed',
    plainEnglish: c.details || `${c.name || 'This check'} did not pass — it lowers your overall certification score.`,
    fixHint: 'Re-run mcp-guardian certify publish after addressing this gap.',
  }));

  return {
    overallScore: score,
    grade,
    summaryPlainEnglish: `This server scores ${score}/100 (grade ${grade}). ${
      failed.length
        ? `${failed.length} certification check(s) failed — see issues below for what to fix.`
        : 'All certification checks passed.'
    } Publish a fresh scan for a full category breakdown.`,
    categories: checks.map((c) => ({
      name: c.name || 'Check',
      score: c.score ?? (c.passed ? 100 : 0),
      weight: 1 / Math.max(checks.length, 1),
      weightPercent: Math.round(100 / Math.max(checks.length, 1)),
      contributionPoints: c.score ?? (c.passed ? 100 : 0),
      findings: c.details ? [c.details] : [],
      plainEnglish: c.details || (c.passed ? 'Passed' : 'Needs attention'),
    })),
    improvementActions: failed.map((c) => ({
      priority: 'high' as const,
      category: c.name || 'Certification',
      action: `Fix: ${c.details || c.name || 'failed check'}`,
      expectedScoreIncrease: 5,
      effort: 'days' as const,
    })),
    issues,
  };
}
