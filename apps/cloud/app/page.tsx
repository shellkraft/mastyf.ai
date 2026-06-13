import Image from 'next/image';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { GITHUB_REPO_URL, GITHUB_README_URL } from '@/lib/github-links';
import { resolveProCheckoutUrl } from '@/lib/pro-checkout-url';
import {
  COMPARISON_ROWS,
  EVIDENCE_ROWS,
  FEATURES,
  HERO_STATS,
  NPM_PACKAGE_URL,
  PROBLEM_BULLETS,
  SOLUTION_PILLARS,
  SWARM_AGENTS,
  TARGET_SEGMENTS,
  USP_ITEMS,
} from '@/components/landing/stats';
import { ThreatArchitectureTabs } from '@/components/landing/ThreatArchitectureTabs';
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
          MCP <span>MastyffAi</span>
        </Link>
        <div className="landing-nav-links">
          <a href={NPM_PACKAGE_URL} rel="noopener noreferrer">
            npm
          </a>
          <a href="#problem">Why MCP security</a>
          <a href="#swarm">Security Swarm</a>
          <a href="#threat-research">Threat research</a>
          <a href="#usp">Why MastyffAi</a>
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
            <span className="landing-pill landing-pill-accent">The MCP security category leader</span>
            <span className="landing-pill landing-pill-success">11k+ npm downloads / month</span>
            <span className="landing-pill landing-pill-warn">557+ adversarial fixtures</span>
            <span className="landing-pill">Self-improving Security Swarm</span>
          </div>
          <h1>Stop AI agents from becoming your next breach vector</h1>
          <p className="lead">
            MCP Mastyff AI is the security proxy between AI agents and MCP servers — inspecting every{' '}
            <code>tools/call</code> and tool response in real time, enforcing YAML policy, and running a
            closed-loop <strong style={{ color: 'var(--text)' }}>Security Swarm</strong> that red-teams
            itself faster than attackers evolve.
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
              @mastyff-ai/server
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

        <section className="landing-section landing-problem" id="problem">
          <div className="landing-section-header">
            <h2>The attack surface nobody is watching</h2>
            <p>
              Claude, GPT-4, and enterprise agents are wired to real systems through MCP — faster than
              security teams can respond. One compromised session looks like a legitimate user.
            </p>
          </div>
          <ul className="landing-problem-list">
            {PROBLEM_BULLETS.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <div className="landing-solution-grid">
            {SOLUTION_PILLARS.map((p) => (
              <article key={p.title} className="landing-solution-card">
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section landing-npm" id="npm">
          <div className="landing-section-header">
            <h2>Trusted on npm</h2>
            <p>
              Install globally with{' '}
              <code>npm install -g @mastyff-ai/server</code> — MIT licensed, TypeScript 5.4, MCP SDK
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
                alt="npm registry page for @mastyff-ai/server showing 11k/month downloads badge, v2.9.6, MIT license, and MCP Mastyff AI readme"
                width={1200}
                height={520}
                style={{ width: '100%', height: 'auto' }}
              />
              <figcaption className="landing-arch-caption">
                Live npm registry —{' '}
                <a href={NPM_PACKAGE_URL} rel="noopener noreferrer">
                  @mastyff-ai/server
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
                <span className="landing-npm-badge-value">@mastyff-ai/server</span>
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
                <code>npm install -g @mastyff-ai/server</code>
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
                MCP Mastyff AI README
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

        <section className="landing-section" id="threat-research">
          <div className="landing-section-header">
            <h2>LLM-powered threat discovery — two architectures</h2>
            <p>
              Pro-tier pipelines that turn live blocks and swarm bypasses into new adversarial fixtures.
              Human review for policy changes; autonomous corpus growth for regression.
            </p>
          </div>
          <ThreatArchitectureTabs />
        </section>

        <section className="landing-section" id="usp">
          <div className="landing-section-header">
            <h2>Why teams choose MCP MastyffAi</h2>
            <p>
              No purpose-built MCP security competitor exists. Generic API gateways don&apos;t understand
              agent behavior — and brittle custom middleware breaks on every SDK update.
            </p>
          </div>
          <div className="landing-usp-grid">
            {USP_ITEMS.map((u) => (
              <article key={u.title} className="landing-usp-card">
                <div className="landing-usp-icon" aria-hidden>
                  ✓
                </div>
                <h3>{u.title}</h3>
                <p>{u.body}</p>
              </article>
            ))}
          </div>
          <div className="card landing-compare" style={{ overflowX: 'auto', padding: 0, marginTop: '2rem' }}>
            <table className="landing-evidence landing-compare-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>MCP MastyffAi</th>
                  <th>Generic gateway / DIY</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.capability}>
                    <td>{row.capability}</td>
                    <td>
                      <span className="landing-compare-yes">{row['mastyff-ai']}</span>
                    </td>
                    <td>
                      <span className="landing-compare-no">{row.generic}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="landing-section">
          <div className="landing-section-header">
            <h2>Built for teams shipping agents to production</h2>
            <p>
              CISO and VP Engineering buyers · platform / AI infra deployers · Kubernetes + Postgres +
              OIDC already in place.
            </p>
          </div>
          <div className="landing-target-grid">
            {TARGET_SEGMENTS.map((t) => (
              <article key={t.title} className="landing-target-card">
                <h3>{t.title}</h3>
                <p>{t.body}</p>
              </article>
            ))}
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

        <section className="landing-section landing-journey">
          <div className="landing-journey-inner card">
            <div>
              <h2>Post-MVP. Pilot-validated. Category-defining.</h2>
              <p>
                330 enterprise attack simulations · 93.3% block rate · 38ms average detection · zero false
                positives. Open-source core on npm; Pro unlocks Security Swarm, threat research pipelines,
                and fleet dashboard. AI agent security is the next major enterprise category — MCP MastyffAi
                is built to define it.
              </p>
            </div>
            <div className="landing-journey-cta">
              <a href={NPM_PACKAGE_URL} className="btn btn-primary" rel="noopener noreferrer">
                Install free on npm
              </a>
              <a href={PRO_CHECKOUT_URL} className="btn" rel="noopener noreferrer">
                Buy Pro — $4.99 lifetime
              </a>
            </div>
          </div>
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
                href="https://github.com/mastyff-ai/mastyff-ai/blob/master/docs/PRO_SETUP.md"
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
            This site validates <code>MASTYFF_AI_LICENSE_KEY</code> at{' '}
            <code>GET /api/v1/license</code>. Free sign-in with Google or GitHub sends you to the
            repo to install MastyffAi; use the{' '}
            <Link href="/dashboard">cloud console</Link> for policy YAML, tenant env snippets, API key
            rotation, and SSO launch into a running self-hosted dashboard.
          </p>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            <strong>Control plane URL (all buyers):</strong>{' '}
            <code>https://mastyff-ai-cloud.vercel.app</code>
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
              npm @mastyff-ai/server
            </a>
          </div>
        </footer>
      </div>
    </div>
  );
}
