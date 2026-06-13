import { GITHUB_README_URL, GITHUB_REPO_URL } from '@/lib/github-links';

export function GitHubGettingStarted() {
  return (
    <div className="card">
      <h2>Get started on GitHub</h2>
      <p className="muted">
        MCP Mastyff AI is self-hosted open source. Install and run the proxy, CLI, and local dashboard
        on your own infrastructure — no cloud subscription required.
      </p>
      <div className="actions" style={{ marginTop: '1rem' }}>
        <a href={GITHUB_REPO_URL} className="btn btn-primary" rel="noopener noreferrer">
          Open MCP Mastyff AI on GitHub
        </a>
        <a href={GITHUB_README_URL} className="btn" rel="noopener noreferrer">
          Installation guide (README)
        </a>
      </div>
    </div>
  );
}
