import { GitHubGettingStarted } from '@/components/GitHubGettingStarted';
import { LaunchDashboard } from '@/components/LaunchDashboard';
import { auth } from '@/lib/auth';
import { getUserOrg } from '@/lib/org-context';
import Link from 'next/link';

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? 'http://localhost:3001').replace(
    /\/$/,
    '',
  );
}

export default async function ConnectMastyffAiPage() {
  const session = await auth();
  const ctx = await getUserOrg(session!.user!.id);
  if (!ctx) return null;

  const envBlock = `# Required on your self-hosted Mastyff AI host for cloud SSO
MASTYFF_AI_MULTI_TENANT_ENABLED=true
MASTYFF_AI_TENANT_ID=${ctx.org.slug}
MASTYFF_AI_CONTROL_PLANE_URL=${appUrl()}
# Same value as AUTH_SECRET on mastyff-ai-cloud (Vercel → Environment Variables):
MASTYFF_AI_CLOUD_JWT_SECRET=<paste-cloud-AUTH_SECRET>
DASHBOARD_JWT_SECRET=<same-as-MASTYFF_AI_CLOUD_JWT_SECRET>
`;

  return (
    <main className="container">
      <p className="footer-links" style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard">← Back to cloud console</Link>
      </p>
      <h1>Connect self-hosted MastyffAi</h1>
      <p className="muted">
        Optional: open your local or remote Mastyff AI ops dashboard with a one-time SSO token. The
        cloud console (policy, API keys) does not need this.
      </p>

      <div className="card">
        <h2>Environment</h2>
        <p className="muted">Restart Mastyff AI after setting these variables.</p>
        <pre className="env-block">{envBlock}</pre>
      </div>

      <LaunchDashboard />
      <GitHubGettingStarted />
    </main>
  );
}
