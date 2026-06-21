import { NextResponse } from 'next/server';
import {
  InvalidPackageNameError,
  isDeepScanEnabled,
  PackageNotFoundError,
  resolvePackageScore,
} from '@/lib/package-score-resolver';
import { packagePathFromSegments } from '@/lib/trust-badge-svg';
import { computeTrustGrade, scoreToLevel } from '@/lib/trust-badge-grade';

type RouteContext = { params: Promise<{ package: string[] }> };

export async function POST(_request: Request, context: RouteContext) {
  const segments = (await context.params).package ?? [];
  const packageName = packagePathFromSegments(segments);

  if (!packageName) {
    return NextResponse.json({ error: 'package required' }, { status: 400 });
  }

  if (!isDeepScanEnabled()) {
    return NextResponse.json(
      {
        error: 'deep_scan_unavailable',
        message:
          'Deep scan requires a Node runtime with subprocess support. Run the cloud app locally on localhost:3001.',
      },
      { status: 501 },
    );
  }

  try {
    const score = await resolvePackageScore(packageName, {
      tier: 'live',
      skipAttestation: true,
      forceRefresh: true,
    });
    return NextResponse.json({
      ok: true,
      packageName: score.packageName,
      version: score.version,
      score: score.score,
      grade: computeTrustGrade(score.score),
      level: score.level || scoreToLevel(score.score),
      scanTier: score.scanTier,
      source: score.source,
      computedAt: score.computedAt,
      expiresAt: score.expiresAt,
    });
  } catch (err: unknown) {
    if (err instanceof PackageNotFoundError || err instanceof InvalidPackageNameError) {
      return NextResponse.json({ error: 'package_not_found' }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : 'deep_scan_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
