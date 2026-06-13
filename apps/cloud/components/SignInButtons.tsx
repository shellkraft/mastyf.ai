'use client';

import { POST_SIGNIN_PATH } from '@/lib/github-links';
import { signIn } from 'next-auth/react';

type Props = {
  callbackUrl?: string;
  googleEnabled?: boolean;
  githubEnabled?: boolean;
};

export function SignInButtons({
  callbackUrl = POST_SIGNIN_PATH,
  googleEnabled = false,
  githubEnabled = false,
}: Props) {
  if (!googleEnabled && !githubEnabled) {
    return (
      <section className="card">
        <p className="muted">
          Cloud sign-in is not configured yet. The operator must add Google and/or GitHub OAuth
          credentials to Vercel. See{' '}
          <a href="https://github.com/mastyff-ai/mastyff-ai/blob/master/docs/OAUTH_CLOUD_SETUP.md">
            docs/OAUTH_CLOUD_SETUP.md
          </a>
          .
        </p>
        <p className="muted" style={{ marginTop: '0.75rem', fontSize: '0.875rem' }}>
          Pro license validation does not require sign-in — use{' '}
          <code>MASTYFF_AI_LICENSE_KEY</code> with{' '}
          <code>MASTYFF_AI_CONTROL_PLANE_URL=https://mastyff-ai-cloud.vercel.app</code>.
        </p>
      </section>
    );
  }

  return (
    <div className="signin-buttons">
      {googleEnabled ? (
        <button
          type="button"
          className="btn btn-google"
          onClick={() => signIn('google', { callbackUrl })}
        >
          Continue with Google
        </button>
      ) : null}
      {githubEnabled ? (
        <button
          type="button"
          className="btn btn-github"
          onClick={() => signIn('github', { callbackUrl })}
        >
          Continue with GitHub
        </button>
      ) : null}
    </div>
  );
}
