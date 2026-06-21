import Link from 'next/link';
import Image from 'next/image';
import { auth } from '@/lib/auth';
import { GITHUB_REPO_URL } from '@/lib/github-links';

type Props = { children: React.ReactNode };

export async function CertifiedShell({ children }: Props) {
  const session = await auth();

  return (
    <div className="socket-shell">
      <header className="socket-nav">
        <Link href="/" className="socket-brand">
          <Image src="/logo.jpeg" alt="" width={28} height={28} className="socket-brand-logo" />
          <strong>mastyf.ai</strong>
        </Link>
        <nav className="socket-nav-links" aria-label="Primary">
          <Link href="/certified">Security scores</Link>
          <Link href="/#security-badge">Badges</Link>
          <Link href="/dashboard">Console</Link>
          <a href={GITHUB_REPO_URL} rel="noopener noreferrer">
            GitHub
          </a>
          {session ? (
            <Link href="/dashboard" className="socket-nav-cta">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="socket-nav-cta">
              Sign in
            </Link>
          )}
        </nav>
      </header>
      {children}
      <footer className="socket-footer">
        <p>
          mastyf.ai security score badges ·{' '}
          <Link href="/certified">Browse certified servers</Link>
          {' · '}
          <Link href="/">Cloud home</Link>
        </p>
      </footer>
    </div>
  );
}
