import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="container">
      <h1>Terms of Service</h1>
      <div className="card">
        <p>
          MCP Mastyff AI Cloud provides an optional hosted control plane for managing policies and
          tenant configuration for self-hosted MCP Mastyff AI deployments. The control plane sign-in
          is free and open source.
        </p>
        <p>
          <strong>MCP Mastyff AI Pro</strong> ($4.99 USD one-time, sold via Lemon Squeezy) is a
          lifetime digital license for self-hosted Pro entitlement. Pro purchases are subject to the
          seller&apos;s refund policy stated at checkout.
        </p>
        <p>
          The service is provided as-is. You are responsible for securing your self-hosted
          Mastyff AI instance and API keys.
        </p>
      </div>
      <Link href="/">Back to home</Link>
    </main>
  );
}
