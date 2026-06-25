import { NextResponse } from 'next/server';
import { authorizeReportsRequest } from '@/lib/reports-auth';
import { buildPerformanceReport, parseReportWindowDays } from '@/lib/performance-report';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authorizeReportsRequest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const windowDays = parseReportWindowDays(url.searchParams.get('window'));

  try {
    const report = await buildPerformanceReport({
      windowDays,
      orgId: auth.source === 'org' ? auth.orgId : undefined,
    });
    return NextResponse.json(report);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'report_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
