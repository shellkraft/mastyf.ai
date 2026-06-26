import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { checkPublicApiRateLimit } from '@/lib/rate-limit';

export default auth(async (request) => {
  const path = request.nextUrl.pathname;

  if (path.startsWith('/api/v1/badge/') || path.startsWith('/api/v1/deep-scan/')) {
    const result = await checkPublicApiRateLimit(request, path);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: { 'Retry-After': String(result.retryAfter) },
        },
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/dashboard/:path*', '/api/v1/badge/:path*', '/api/v1/deep-scan/:path*'],
};
