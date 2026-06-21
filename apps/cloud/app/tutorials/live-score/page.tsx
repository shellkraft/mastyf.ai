import Link from 'next/link';
import { resolveSiteUrl } from '@/lib/site-url';
import '../certified.css';

export const metadata = {
  title: 'Tutorial — Live MCP security scores | mastyf.ai',
  description: 'Short walkthrough: look up an MCP package and fetch live security scores on mastyf.ai.',
};

export default function LiveScoreTutorialPage() {
  const base = resolveSiteUrl();
  return (
    <main className="socket-main" style={{ paddingTop: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <p className="socket-breadcrumb">
        <Link href="/certified">Security scores</Link> / Tutorial
      </p>
      <h1 className="socket-pkg-title">How to fetch live MCP security scores</h1>
      <p className="certified-lead" style={{ marginBottom: '1.5rem' }}>
        ~90 second walkthrough: look up <code>@playwright/mcp</code>, preview the badge, open the
        score page, and use the JSON API.
      </p>
      <video
        controls
        playsInline
        preload="metadata"
        style={{ width: '100%', borderRadius: 12, background: '#0a0a0a' }}
        poster="/assets/security-swarm-architecture.png"
      >
        <source src="/tutorials/live-security-score-demo.webm" type="video/webm" />
        Your browser does not support WebM video.{' '}
        <a href="/tutorials/live-security-score-demo.webm">Download the tutorial</a>.
      </video>
      <p className="certified-meta" style={{ marginTop: '1rem' }}>
        Direct link:{' '}
        <a href="/tutorials/live-security-score-demo.webm">/tutorials/live-security-score-demo.webm</a>
        {' · '}
        <Link href="/certified">Try it yourself</Link>
      </p>
      <pre className="badge-embed-code" style={{ marginTop: '1.5rem', fontSize: '0.8rem' }}>
        {`curl -s "${base}/api/v1/badge/@playwright%2Fmcp/json"`}
      </pre>
    </main>
  );
}
