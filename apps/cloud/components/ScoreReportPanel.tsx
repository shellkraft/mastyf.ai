import type { ImprovementAction, PublishableIssue, PublishableScoreReport } from '@/lib/score-report';

type Props = {
  report: PublishableScoreReport;
};

const SEV_CLASS: Record<PublishableIssue['severity'], string> = {
  critical: 'issue-critical',
  high: 'issue-high',
  medium: 'issue-medium',
  low: 'issue-low',
  info: 'issue-info',
};

const PRIORITY_LABEL: Record<ImprovementAction['priority'], string> = {
  immediate: 'Fix now',
  high: 'High priority',
  medium: 'Recommended',
  low: 'Nice to have',
};

export function ScoreReportPanel({ report }: Props) {
  return (
    <div className="score-report">
      <section className="score-report-section">
        <h2 className="socket-section-title">Why this score?</h2>
        <p className="score-report-summary">{report.summaryPlainEnglish}</p>
        <div className="score-report-contrib">
          <h3 className="score-report-subtitle">How the {report.overallScore}/100 is calculated</h3>
          <table className="score-report-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Score</th>
                <th>Weight</th>
                <th>Points toward total</th>
              </tr>
            </thead>
            <tbody>
              {report.categories.map((cat) => (
                <tr key={cat.name}>
                  <td>{cat.name}</td>
                  <td>
                    <span className={`score-report-pill score-${cat.score >= 70 ? 'good' : cat.score >= 40 ? 'warn' : 'bad'}`}>
                      {cat.score}/100
                    </span>
                  </td>
                  <td>{cat.weightPercent}%</td>
                  <td>+{cat.contributionPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="score-report-section">
        <h2 className="socket-section-title">Category breakdown</h2>
        <div className="score-report-categories">
          {report.categories.map((cat) => (
            <article key={cat.name} className="score-report-category">
              <div className="score-report-category-head">
                <strong>{cat.name}</strong>
                <span className={`score-report-pill score-${cat.score >= 70 ? 'good' : cat.score >= 40 ? 'warn' : 'bad'}`}>
                  {cat.score}/100
                </span>
              </div>
              <div className="score-report-bar-track">
                <div className="score-report-bar-fill" style={{ width: `${cat.score}%` }} />
              </div>
              <p className="score-report-plain">{cat.plainEnglish}</p>
              {cat.findings.length > 0 ? (
                <ul className="score-report-findings">
                  {cat.findings.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {report.issues.length > 0 ? (
        <section className="score-report-section">
          <h2 className="socket-section-title">Issues found</h2>
          <p className="certified-lead">Plain-language findings from the security scan — fix these to improve your score.</p>
          <ul className="score-report-issues">
            {report.issues.map((issue, i) => (
              <li key={`${issue.title}-${i}`} className={`score-report-issue ${SEV_CLASS[issue.severity]}`}>
                <div className="score-report-issue-head">
                  <span className="score-report-sev">{issue.severity}</span>
                  <strong>{issue.title}</strong>
                </div>
                <p>{issue.plainEnglish}</p>
                <p className="score-report-fix">
                  <strong>How to fix:</strong> {issue.fixHint}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.improvementActions.length > 0 ? (
        <section className="score-report-section">
          <h2 className="socket-section-title">How to improve your score</h2>
          <ol className="score-report-actions">
            {report.improvementActions.map((action, i) => (
              <li key={`${action.category}-${i}`}>
                <span className={`score-report-priority priority-${action.priority}`}>
                  {PRIORITY_LABEL[action.priority]}
                </span>
                <p className="score-report-action-text">{action.action}</p>
                <p className="score-report-action-meta">
                  Est. +{action.expectedScoreIncrease} points · ~{action.effort}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
