import { CloudConsoleBanner } from '@/components/CloudConsoleBanner';
import { GitHubGettingStarted } from '@/components/GitHubGettingStarted';
import { auth } from '@/lib/auth';
import { getUserOrg } from '@/lib/org-context';
import Link from 'next/link';

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? 'http://localhost:3001').replace(
    /\/$/,
    '',
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const ctx = await getUserOrg(session!.user!.id);
  if (!ctx) return null;

  const envBlock = `# MCP Mastyff AI — connect your self-hosted instance (optional cloud policy / advanced SSO)
MASTYFF_AI_MULTI_TENANT_ENABLED=true
MASTYFF_AI_TENANT_ID=${ctx.org.slug}
MASTYFF_AI_CONTROL_PLANE_URL=${appUrl()}
# Copy AUTH_SECRET from Vercel (mastyff-ai-cloud → Settings → Environment Variables):
MASTYFF_AI_CLOUD_JWT_SECRET=<paste-cloud-AUTH_SECRET>
DASHBOARD_JWT_SECRET=<same-as-MASTYFF_AI_CLOUD_JWT_SECRET>
# Optional — Pro license / policy API:
# MASTYFF_AI_LICENSE_KEY=<gcp_...-from-settings>
# Policy file path on your Mastyff AI host:
# policy-templates/tenants/${ctx.org.slug}/policy.yaml

# Pull policy via API (optional automation):
# curl -H "Authorization: Bearer <api-key>" ${appUrl()}/api/v1/policy
`;

  return (
    <main className="container">
      <h1>{ctx.org.name}</h1>
      <p className="muted">
        Tenant ID: <code>{ctx.org.slug}</code>
      </p>

      <div className="card">
        <h2>Connect self-hosted MastyffAi</h2>
        <p className="muted">
          Copy these settings into your Helm values, docker-compose, or .env. Download policy YAML
          from the Policy page or sync via the API. Mastyff AI is fully open source — no subscription
          required.
        </p>
        <pre className="env-block">{envBlock}</pre>
        <div className="actions">
          <Link href="/dashboard/policy" className="btn">
            Edit policy
          </Link>
          <Link href="/dashboard/settings" className="btn">
            API keys
          </Link>
        </div>
      </div>

      <GitHubGettingStarted />
    </main>
  );
}
