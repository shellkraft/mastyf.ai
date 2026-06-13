import Link from 'next/link';

/** Clarifies that /dashboard is the cloud console — no self-hosted Mastyff AI required. */
export function CloudConsoleBanner() {
  return (
    <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--accent, #3b82f6)' }}>
      <h2 style={{ marginTop: 0 }}>Cloud console</h2>
      <p className="muted" style={{ marginBottom: '0.75rem' }}>
        You are signed in to MCP Mastyff AI Cloud. Edit policy, copy your tenant env snippet, and manage
        API keys here — no local Mastyff AI process required.
      </p>
      <p className="muted" style={{ marginBottom: 0, fontSize: '0.9rem' }}>
        To run the proxy and ops dashboard on your own machine, use{' '}
        <strong>Get started on GitHub</strong> on the homepage. Optional SSO into a running
        self-hosted instance: <Link href="/dashboard/connect">Connect self-hosted MastyffAi</Link>.
      </p>
    </div>
  );
}
