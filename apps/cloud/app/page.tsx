import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { GITHUB_REPO_URL, GITHUB_README_URL } from '@/lib/github-links';
import { resolveProCheckoutUrl } from '@/lib/pro-checkout-url';
import {
  EVIDENCE_ROWS,
  FEATURES,
  HERO_STATS,
  NPM_PACKAGE_URL,
  SWARM_AGENTS,
} from '@/components/landing/stats';
import './landing.css';

const PRO_CHECKOUT_URL = resolveProCheckoutUrl();

const CI_AGENTS = SWARM_AGENTS.filter((a) => a.track === 'CI');
const RUNTIME_AGENTS = SWARM_AGENTS.filter((a) => a.track === 'Runtime');

function trustClass(trust: string): string {
  if (trust === 'CI-gated') return 'landing-trust landing-trust-ci';
  if (trust === 'Synthetic') return 'landing-trust landing-trust-synth';
  return 'landing-trust landing-trust-eval';
}

export default async function HomePage() {
  const session = await auth();

  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link href="/" className="brand">
          MCP <span>Guardian</span>
        </Link>
        <div className="landing-nav-links">
          <a href={NPM_PACKAGE_URL} rel="noopener noreferrer">
            npm
          </a>
          <a href="#swarm">Security Swarm</a>
          <a href="#evidence">Evidence</a>
          <a href="#pricing">Pricing</a>
          <Link href="/dashboard">Cloud console</Link>
          {session ? (
            <a href={GITHUB_REPO_URL} rel="noopener noreferrer">
              GitHub
            </a>
          ) : (
            <Link href="/login">Sign in</Link>
          )}
        </div>
      </nav>

      <div className="landing-wrap">
        <header className="landing-hero" id="top">
          <div className="landing-eyebrow">
            <span className="landing-pill landing-pill-accent">v3.0 — Pro paywall + dual license</span>
            <span className="landing-pill landing-pill-success">MIT Community on npm</span>
            <span className="landing-pill landing-pill-success">11k+ downloads / month</span>
            <span className="landing-pill">CI-gated adversarial harness</span>
          </div>
          <h1>Runtime security for MCP infrastructure</h1>
          <p className="lead">
            Transparent proxy between AI agents and MCP servers — three-layer detection, cost
            governance, health monitoring, and a closed-loop{' '}
            <strong style={{ color: 'var(--text)' }}>Security Swarm</strong> that gates policy in CI
            and learns from every blocked <code>tools/call</code>.
          </p>
          <div className="landing-hero-cta">
            {session ? (
              <>
                <a href={GITHUB_REPO_URL} className="btn btn-primary" rel="noopener noreferrer">
                  Get started on GitHub
                </a>
                <Link href="/dashboard" className="btn">
                  Cloud console
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="btn btn-primary">
                  Sign in free
                </Link>
                <a href={GITHUB_REPO_URL} className="btn" rel="noopener noreferrer">
                  View on GitHub
                </a>
              </>
            )}
            <a
              href={NPM_PACKAGE_URL}
              className="btn"
              rel="noopener noreferrer"
              style={{ borderColor: 'rgba(34, 197, 94, 0.45)' }}
            >
              Install from npm
            </a>
            <a
              href={PRO_CHECKOUT_URL}
              className="btn"
              rel="noopener noreferrer"
              style={{ borderColor: 'rgba(59, 130, 246, 0.5)' }}
            >
              Buy Pro — $4.99
            </a>
          </div>
          <p className="muted" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
            <a href={NPM_PACKAGE_URL} rel="noopener noreferrer">
              @mcp-guardian/server
            </a>
            {' · '}
            11k+ downloads/month · Works with Cursor, Cline, Claude Code
          </p>
        </header>

        <section className="landing-stats" aria-label="Key metrics">
          {HERO_STATS.map((s) => {
            const isNpm = s.label.includes('npm');
            const inner = (
              <>
                <div className="landing-stat-value">{s.value}</div>
                <div className="landing-stat-label">{s.label}</div>
                <div className="landing-stat-detail">{s.detail}</div>
              </>
            );
            return isNpm ? (
              <a
                key={s.label}
                href={NPM_PACKAGE_URL}
                className="landing-stat landing-stat-link"
                rel="noopener noreferrer"
              >
                {inner}
              </a>
            ) : (
              <article key={s.label} className="landing-stat">
                {inner}
              </article>
            );
          })}
        </section>

        <section className="landing-section landing-npm" id="npm">
          <div className="landing-section-header">
            <h2>Trusted on npm</h2>
            <p>
              Install globally with{' '}
              <code>npm install -g @mcp-guardian/server</code> — MIT licensed, TypeScript 5.4, MCP SDK
              1.25. Over <strong>10,000 monthly downloads</strong> on{' '}
              <a href={NPM_PACKAGE_URL} rel="noopener noreferrer">
                npmjs.com
              </a>
              .
            </p>
          </div>
          <div className="landing-npm-grid">
            <figure className="landing-npm-shot">
              <Image
                src="/assets/npm-package-screenshot.png"
                alt="npm registry page for @mcp-guardian/server showing 11k/month downloads badge, v2.9.6, MIT license, and MCP Guardian readme"
                width={1200}
                height={520}
                style={{ width: '100%', height: 'auto' }}
              />
              <figcaption className="landing-arch-caption">
                Live npm registry —{' '}
                <a href={NPM_PACKAGE_URL} rel="noopener noreferrer">
                  @mcp-guardian/server
                </a>
              </figcaption>
            </figure>
            <div className="landing-npm-badges">
              <a
                href={NPM_PACKAGE_URL}
                rel="noopener noreferrer"
                className="landing-npm-badge"
              >
                <span className="landing-npm-badge-label">Downloads</span>
                <span className="landing-npm-badge-value">11k / month</span>
              </a>
              <a
                href={NPM_PACKAGE_URL}
                rel="noopener noreferrer"
                className="landing-npm-badge"
              >
                <span className="landing-npm-badge-label">Package</span>
                <span className="landing-npm-badge-value">@mcp-guardian/server</span>
              </a>
              <div className="landing-npm-badge landing-npm-badge-static">
                <span className="landing-npm-badge-label">License</span>
                <span className="landing-npm-badge-value">MIT</span>
              </div>
              <div className="landing-npm-badge landing-npm-badge-static">
                <span className="landing-npm-badge-label">MCP SDK</span>
                <span className="landing-npm-badge-value">1.25</span>
              </div>
              <a href={NPM_PACKAGE_URL} className="btn btn-primary" rel="noopener noreferrer">
                View on npm
              </a>
              <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                <code>npm install -g @mcp-guardian/server</code>
              </p>
            </div>
          </div>
        </section>

        <section className="landing-section" id="swarm">
          <div className="landing-section-header">
            <h2>Security Swarm — agentic architecture</h2>
            <p>
              Two tracks: <strong>CI</strong> validates policy before merge; <strong>runtime</strong>{' '}
              learns from live proxy blocks. Solo analyze adds live MCP probes and dashboard reports.
            </p>
          </div>
          <figure className="landing-arch">
            <Image
              src="/assets/security-swarm-architecture.png"
              alt="Security Swarm diagram: CI agents Scout through Report, runtime BlockGuard through Calibrator, connected to MCP proxy and dashboard"
              width={1400}
              height={900}
              priority
              style={{ width: '100%', height: 'auto' }}
            />
            <figcaption className="landing-arch-caption">
              Closed-loop workflow from the{' '}
              <a href={GITHUB_README_URL} rel="noopener noreferrer">
                MCP Guardian README
              </a>
              : corpus regression, evasion probes, parity checks, and instant attack learning on the
              hot path.
            </figcaption>
          </figure>
          <div className="landing-tracks">
            <div className="landing-track landing-track-ci">
              <h3>CI track</h3>
              <ul className="landing-agent-list">
                {CI_AGENTS.map((a) => (
                  <li key={a.name}>
                    <span className="landing-agent-name">{a.name}</span>
                    <span className="landing-agent-role">{a.role}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="landing-track landing-track-runtime">
              <h3>Runtime track</h3>
              <ul className="landing-agent-list">
                {RUNTIME_AGENTS.map((a) => (
                  <li key={a.name}>
                    <span className="landing-agent-name">{a.name}</span>
                    <span className="landing-agent-role">{a.role}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-header">
            <h2>Three-layer detection engine</h2>
            <p>Regex triage → schema validation → optional semantic LLM with circuit breaker and local fallback.</p>
          </div>
          <div className="landing-detection">
            <div className="landing-layer">
              <div className="landing-layer-num">1</div>
              <h3>Regex triage</h3>
              <p>TR39 confusables offline, chaining patterns, fast block on obvious injection and exfil paths.</p>
            </div>
            <div className="landing-layer">
              <div className="landing-layer-num">2</div>
              <h3>Schema analysis</h3>
              <p>Ajv validation, recursive depth limits, maxLength — catch malformed or oversized tool payloads.</p>
            </div>
            <div className="landing-layer">
              <div className="landing-layer-num">3</div>
              <h3>Semantic (Pro)</h3>
              <p>Async tier-2 LLM audit, 10/min cap, 24h cache, Ollama/local fallback when API exhausted.</p>
            </div>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-header">
            <h2>Built for production MCP fleets</h2>
            <p>Self-hosted open source with optional cloud control plane and lifetime Pro license.</p>
          </div>
          <div className="landing-features">
            {FEATURES.map((f) => (
              <article key={f.title} className="landing-feature">
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section" id="evidence">
          <div className="landing-section-header">
            <h2>Proven under attack</h2>
            <p>
              Four evidence layers in the repo — use CI-gated harness numbers for procurement; synthetic
              sims are labeled explicitly.
            </p>
          </div>
          <div className="card" style={{ overflowX: 'auto', padding: 0 }}>
            <table className="landing-evidence">
              <thead>
                <tr>
                  <th>Suite</th>
                  <th>Result</th>
                  <th>Trust</th>
                </tr>
              </thead>
              <tbody>
                {EVIDENCE_ROWS.map((row) => (
                  <tr key={row.suite}>
                    <td>{row.suite}</td>
                    <td>{row.result}</td>
                    <td>
                      <span className={trustClass(row.trust)}>{row.trust}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem' }}>
            Full reports:{' '}
            <a href={`${GITHUB_REPO_URL}/tree/master/reports/adversarial-harness`} rel="noopener noreferrer">
              adversarial-harness
            </a>
            {' · '}
            <a href={`${GITHUB_REPO_URL}/tree/master/reports/enterprise-attack-sim`} rel="noopener noreferrer">
              enterprise-attack-sim
            </a>
          </p>
        </section>

        <section className="landing-pricing" id="pricing">
          <div className="landing-section-header">
            <h2>Community &amp; Pro</h2>
            <p>
              npm install is always free (MIT). Pro unlocks dashboard, Security Swarm CLI, fleet, AI
              learning, and multi-tenant JWT — validated against this control plane.
            </p>
          </div>
          <div className="pricing-grid">
            <section className="price-card">
              <div className="badge badge-muted">Community</div>
              <div className="amount">Free</div>
              <div className="period">MIT open source</div>
              <p className="muted" style={{ marginTop: '1rem' }}>
                Proxy, CLI, local YAML policy, adversarial harness, and corpus eval — no license key.
                Sign in here to optionally manage cloud policy snippets and API keys.
              </p>
              {session ? (
                <>
                  <a
                    href={GITHUB_REPO_URL}
                    className="btn btn-primary"
                    style={{ display: 'block' }}
                    rel="noopener noreferrer"
                  >
                    Get started on GitHub
                  </a>
                  <Link href="/dashboard" className="btn" style={{ display: 'block', marginTop: '0.5rem' }}>
                    Cloud console
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="btn btn-primary" style={{ display: 'block' }}>
                    Sign in (free)
                  </Link>
                  <a
                    href={NPM_PACKAGE_URL}
                    className="btn"
                    style={{ display: 'block', marginTop: '0.5rem' }}
                    rel="noopener noreferrer"
                  >
                    Install from npm
                  </a>
                </>
              )}
            </section>

            <section className="price-card price-card-pro">
              <div className="badge badge-active">Pro</div>
              <div className="amount">$4.99</div>
              <div className="period">Lifetime · one-time</div>
              <p className="muted" style={{ marginTop: '1rem' }}>
                Lifetime license for self-hosted Pro: Security Swarm CLI, live dashboard, WebSocket feed,
                AI learning, fleet TUI, semantic async, multi-tenant bindings.
              </p>
              <ul className="pro-features">
                <li>License key by email + fixed control plane URL</li>
                <li>Self-hosted — your data stays on your infrastructure</li>
                <li>v3.0+ enforced on swarm CLI; pinned older npm tags unchanged</li>
              </ul>
              <a
                href={PRO_CHECKOUT_URL}
                className="btn btn-primary"
                style={{ display: 'block' }}
                rel="noopener noreferrer"
              >
                Buy Pro — $4.99
              </a>
              <Link
                href="https://github.com/rudraneel93/mcp-guardian/blob/master/docs/PRO_SETUP.md"
                className="btn"
              >
                Pro setup guide
              </Link>
            </section>
          </div>
        </section>

        <section className="card">
          <h2>Cloud control plane (optional)</h2>
          <p className="muted">
            This site validates <code>GUARDIAN_LICENSE_KEY</code> at{' '}
            <code>GET /api/v1/license</code>. Free sign-in with Google or GitHub sends you to the
            repo to install Guardian; use the{' '}
            <Link href="/dashboard">cloud console</Link> for policy YAML, tenant env snippets, API key
            rotation, and SSO launch into a running self-hosted dashboard.
          </p>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            <strong>Control plane URL (all buyers):</strong>{' '}
            <code>https://mcp-guardian-cloud.vercel.app</code>
          </p>
        </section>

        <footer className="landing-footer">
          <div className="footer-links">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <a href={GITHUB_REPO_URL} rel="noopener noreferrer">
              GitHub
            </a>
            <a href={NPM_PACKAGE_URL} rel="noopener noreferrer">
              npm @mcp-guardian/server
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
