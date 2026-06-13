import { randomUUID } from 'crypto';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { licenseExchangeTokens } from '@/lib/db/schema';
import { generateExchangeToken, hashExchangeToken } from '@/lib/license';
import { getUserOrg } from '@/lib/org-context';
import { NextResponse } from 'next/server';

const EXCHANGE_TTL_SECONDS = 60;

function normalizeMastyffAiUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.pathname = url.pathname.replace(/\/$/, '');
    return url.origin + url.pathname.replace(/\/$/, '');
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ctx = await getUserOrg(session.user.id);
  if (!ctx) {
    return NextResponse.json({ error: 'No organization' }, { status: 403 });
  }

  const body = (await request.json()) as { mastyffAiUrl?: string };
  const mastyffAiUrl = normalizeMastyffAiUrl(body.mastyffAiUrl ?? '');
  if (!mastyffAiUrl) {
    return NextResponse.json({ error: 'Valid mastyffAiUrl required (http/https)' }, { status: 400 });
  }

  const plaintext = generateExchangeToken();
  const expiresAt = new Date(Date.now() + EXCHANGE_TTL_SECONDS * 1000);

  await getDb().insert(licenseExchangeTokens).values({
    id: randomUUID(),
    orgId: ctx.org.id,
    tokenHash: hashExchangeToken(plaintext),
    mastyffAiUrl,
    expiresAt,
  });

  const redirectUrl = `${mastyffAiUrl}/api/auth/cloud-exchange?token=${encodeURIComponent(plaintext)}`;

  return NextResponse.json({ redirectUrl, expiresIn: EXCHANGE_TTL_SECONDS });
}
