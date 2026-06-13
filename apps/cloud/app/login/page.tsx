import Link from 'next/link';
import { SignInButtons } from '@/components/SignInButtons';
import { auth } from '@/lib/auth';
import { POST_SIGNIN_PATH } from '@/lib/github-links';
import { oauthProviderStatus } from '@/lib/oauth-providers';
import { redirect } from 'next/navigation';

type Props = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: 'OAuth is misconfigured. Check Vercel environment variables.',
  AccessDenied: 'Access was denied. Try another account or contact support.',
  Verification: 'Sign-in link expired. Try again.',
  OAuthAccountNotLinked:
    'This email is already linked to another sign-in method. Use the same provider you used before.',
  OAuthSignin: 'Could not start OAuth. Try again.',
  OAuthCallback: 'OAuth callback failed. Confirm redirect URIs in Google/GitHub app settings.',
  OAuthCreateAccount: 'Could not create your account. Check database logs.',
  CallbackRouteError: 'Sign-in callback error. Try again.',
  Default: 'Sign-in failed. Try again.',
  ProvisionFailed: 'Signed in, but organization setup failed. Try again or contact support.',
};

export default async function LoginPage({ searchParams }: Props) {
  const session = await auth();
  const params = await searchParams;
  let callbackUrl = params.callbackUrl ?? POST_SIGNIN_PATH;
  try {
    const parsed = new URL(callbackUrl, 'http://local');
    if (parsed.pathname.startsWith('/')) {
      callbackUrl = `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    /* keep as-is */
  }
  const errorCode = params.error;
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.Default)
    : null;

  if (session?.user?.id) {
    redirect(callbackUrl);
  }

  const oauth = oauthProviderStatus();

  return (
    <main className="container">
      <section className="hero">
        <h1>Sign in</h1>
        <p className="muted">Use Google or GitHub to access MCP Mastyff AI Cloud.</p>
      </section>
      {errorMessage ? (
        <p className="alert alert-warn" role="alert">
          {errorMessage}
          {errorCode ? (
            <span className="muted" style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.8rem' }}>
              Code: {errorCode}
            </span>
          ) : null}
        </p>
      ) : null}
      <SignInButtons
        callbackUrl={callbackUrl}
        googleEnabled={oauth.google}
        githubEnabled={oauth.github}
      />
      <p className="footer-links">
        <Link href="/">Back to home</Link>
      </p>
    </main>
  );
}
