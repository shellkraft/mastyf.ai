import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { verifyPublicCertification } from '@/lib/industry-standard';
import {
  InvalidPackageNameError,
  isDeepScanEnabled,
  PackageNotFoundError,
  resolvePackageScore,
} from '@/lib/package-score-resolver';
import { BadgeEmbedGallery } from '@/components/BadgeEmbedGallery';
import { DeepScanButton } from '@/components/DeepScanButton';
import { PackageNotFound } from '@/components/PackageNotFound';
import { ScanTierBadge } from '@/components/ScanTierBadge';
import { ScoreReportPanel } from '@/components/ScoreReportPanel';
import { ScoreRing } from '@/components/ScoreRing';
import { computeTrustGrade } from '@/lib/trust-badge-grade';
import { certificationChecksOnly } from '@/lib/score-report';
import {
  packagePathFromSegments,
  renderTrustBadgeSvg,
  resolveCloudBaseUrl,
} from '@/lib/trust-badge-svg';
import '../certified.css';
import '../socket-certified.css';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ package: string[] }> };

async function resolveCloudBaseFromHeaders(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  const proto = h.get('x-forwarded-proto') || 'http';
  if (host) return `${proto}://${host}`;
  return resolveCloudBaseUrl();
}

export default async function CertifiedPackagePage({ params }: Props) {
  const segments = (await params).package ?? [];
  const packageName = packagePathFromSegments(segments);
  if (!packageName) notFound();

  const cloudBase = await resolveCloudBaseFromHeaders();

  let score: Awaited<ReturnType<typeof resolvePackageScore>>;
  try {
    score = await resolvePackageScore(packageName);
  } catch (err: unknown) {
    if (err instanceof PackageNotFoundError || err instanceof InvalidPackageNameError) {
      return <PackageNotFound packageName={packageName} />;
    }
    throw err;
  }

  const grade = computeTrustGrade(score.score);
  const scoreReport = score.scoreReport;

  let verification: Awaited<ReturnType<typeof verifyPublicCertification>> | null = null;
  if (score.source === 'attested') {
    try {
      verification = await verifyPublicCertification(score.id);
    } catch {
      verification = null;
    }
  }

  const badgeSvg = renderTrustBadgeSvg({
    score: score.score,
    grade,
    packageName,
    style: 'flat',
  });

  return (
    <main className="socket-main" style={{ paddingTop: '2rem' }}>
      <p className="socket-breadcrumb">
        <Link href="/certified">Security scores</Link> / {packageName}
      </p>

      <div className="socket-pkg-header">
        <ScoreRing score={score.score} grade={grade} size={160} />
        <div>
          <h1 className="socket-pkg-title">{packageName}</h1>
          <p className="socket-pkg-meta">
            {score.serverName} · v{score.version} ·{' '}
            <span style={{ textTransform: 'capitalize' }}>{score.level}</span>
            {' · '}
            <ScanTierBadge tier={score.scanTier} source={score.source} />
          </p>
          <div
            className="certified-hero-badge"
            style={{ marginBottom: '1rem' }}
            dangerouslySetInnerHTML={{ __html: badgeSvg }}
          />
          <p className="score-report-summary" style={{ margin: '0.75rem 0' }}>
            {scoreReport.summaryPlainEnglish}
          </p>
          <p className="certified-meta">
            Scored {new Date(score.computedAt).toLocaleString()} · Cache expires{' '}
            {new Date(score.expiresAt).toLocaleString()}
          </p>
          {verification ? (
            <p className={`socket-status ${verification.valid ? 'valid' : 'invalid'}`}>
              Attestation {verification.valid ? 'valid' : verification.expired ? 'expired' : 'invalid'}
            </p>
          ) : null}
          <DeepScanButton
            packageName={packageName}
            enabled={isDeepScanEnabled()}
            currentTier={score.scanTier}
            source={score.source}
          />
        </div>
      </div>

      <ScoreReportPanel report={scoreReport} />

      <div className="socket-two-col" style={{ marginTop: '2rem' }}>
        <section>
          <h2 className="socket-section-title">Embed badge</h2>
          <p className="certified-lead">
            Pick a layout (GitHub README, flat-square, plastic, …) and copy markdown, HTML, RST,
            BBCode, or AsciiDoc.
          </p>
          <BadgeEmbedGallery
            cloudBaseUrl={cloudBase}
            packageName={packageName}
            badgeCacheKey={score.computedAt}
          />
        </section>
        {score.source === 'attested' ? (
          <section>
            <h2 className="socket-section-title">Maintainer attestation</h2>
            <p className="certified-lead">
              This score was published with a signed attestation from a maintainer proxy scan.
            </p>
            <pre className="badge-embed-code" style={{ border: '1px solid var(--border)', borderRadius: 8 }}>
              {`mastyf-ai certify publish \\
  --server ${score.serverName} \\
  --package ${packageName} \\
  --pkg-version ${score.version} \\
  --cloud-url ${cloudBase}`}
            </pre>
          </section>
        ) : (
          <section>
            <h2 className="socket-section-title">Improve this score</h2>
            <p className="certified-lead">
              Fix the issues above, then run a deep scan or publish from your mastyf.ai proxy for a
              maintainer-verified badge.
            </p>
            {certificationChecksOnly(score.checks).length > 0 ? (
              <ul className="certified-check-list">
                {certificationChecksOnly(score.checks).map((c) => (
                  <li key={String(c.id ?? c.name)}>
                    [{c.passed ? '✓' : '✗'}] {c.name}: {c.details}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
