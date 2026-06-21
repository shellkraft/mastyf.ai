import { GitHubGettingStarted } from '@/components/GitHubGettingStarted';
import { LaunchDashboard } from '@/components/LaunchDashboard';
import { auth } from '@/lib/auth';
import { getUserOrg } from '@/lib/org-context';
import { CLOUD_NAME, NPM_PRODUCT_NAME, SITE_NAME } from '@/lib/product-links';
import Link from 'next/link';

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? 'http://localhost:3001').replace(
    /\/$/,
    '',
  );
}

export default async function ConnectMastyfAiPage() {
  const session = await auth();
  const ctx = await getUserOrg(session!.user!.id);
  if (!ctx) return null;

  const envBlock = `# Link ${NPM_PRODUCT_NAME} to ${SITE_NAME} Cloud (optional — for policy sync + SSO)
MASTYF_AI_MULTI_TENANT_ENABLED=true
MASTYF_AI_TENANT_ID=${ctx.org.slug}
MASTYF_AI_CONTROL_PLANE_URL=${appUrl()}
# Same value as AUTH_SECRET in ${SITE_NAME} Cloud (.env.local or Vercel):
MASTYF_AI_CLOUD_JWT_SECRET=<paste-cloud-AUTH_SECRET>
DASHBOARD_JWT_SECRET=<same-as-MASTYF_AI_CLOUD_JWT_SECRET>
`;

  return (
    <main className="container">
      <p className="footer-links" style={{ marginBottom: '1rem' }}>
        <Link href="/dashboard">← Back to cloud console</Link>
      </p>
      <h1>Link {NPM_PRODUCT_NAME} to {CLOUD_NAME}</h1>
      <p className="muted">
        Optional advanced setup. Copy these env vars onto a self-hosted {NPM_PRODUCT_NAME} host so it
        pulls policy from your {SITE_NAME} tenant and supports one-click SSO into the local ops
        dashboard. The {SITE_NAME} console itself does not need this.
      </p>

      <div className="card">
        <h2>{NPM_PRODUCT_NAME} environment</h2>
        <p className="muted">Restart the proxy after setting these on your self-hosted host.</p>
        <pre className="env-block">{envBlock}</pre>
      </div>

      <LaunchDashboard />
      <GitHubGettingStarted />
    </main>
  );
}
