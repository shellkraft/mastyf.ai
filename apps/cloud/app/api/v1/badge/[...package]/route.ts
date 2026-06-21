import { NextResponse } from 'next/server';
import {
  InvalidPackageNameError,
  PackageNotFoundError,
  resolvePackageScore,
} from '@/lib/package-score-resolver';
import { computeTrustGrade, scoreToLevel } from '@/lib/trust-badge-grade';
import { BADGE_RENDERER_VERSION } from '@/lib/badge-brand';
import {
  packagePathFromSegments,
  renderTrustBadgeSvg,
  resolveCloudBaseUrl,
  normalizeBadgeStyle,
} from '@/lib/trust-badge-svg';

type RouteContext = { params: Promise<{ package: string[] }> };

function wantsJson(segments: string[], request: Request): boolean {
  if (segments[segments.length - 1] === 'json') return true;
  const url = new URL(request.url);
  return url.searchParams.get('format') === 'json';
}

export async function GET(request: Request, context: RouteContext) {
  const segments = (await context.params).package ?? [];
  const packageName = packagePathFromSegments(segments);
  const url = new URL(request.url);
  const style = normalizeBadgeStyle(url.searchParams.get('style'));

  if (!packageName) {
    return NextResponse.json({ error: 'package required' }, { status: 400 });
  }

  try {
    const score = await resolvePackageScore(packageName);
    const grade = computeTrustGrade(score.score);

    if (wantsJson(segments, request)) {
      return NextResponse.json({
        found: true,
        packageName: score.packageName,
        serverName: score.serverName,
        version: score.version,
        score: score.score,
        grade,
        level: score.level || scoreToLevel(score.score),
        scanTier: score.scanTier,
        source: score.source,
        certificationId: score.id,
        checks: score.checks,
        computedAt: score.computedAt,
        expiresAt: score.expiresAt,
        badgeUrl: `${resolveCloudBaseUrl(request)}/api/v1/badge/${encodeURIComponent(packageName)}?style=github&v=${BADGE_RENDERER_VERSION}`,
        verifyUrl: `${resolveCloudBaseUrl(request)}/certified/${encodeURIComponent(packageName)}`,
      });
    }

    const svg = renderTrustBadgeSvg({
      score: score.score,
      grade,
      packageName: score.packageName,
      style,
    });

    const etag = `"${score.computedAt}-${score.score}-${score.scanTier}"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          'Cache-Control': 'public, max-age=300, must-revalidate',
        },
      });
    }

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, must-revalidate',
        ETag: etag,
      },
    });
  } catch (err: unknown) {
    if (err instanceof PackageNotFoundError || err instanceof InvalidPackageNameError) {
      if (wantsJson(segments, request)) {
        return NextResponse.json({ found: false, packageName }, { status: 404 });
      }
      return NextResponse.json({ error: 'package_not_found' }, { status: 404 });
    }
    const message = err instanceof Error ? err.message : 'score_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
