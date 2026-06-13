import Link from 'next/link';

const links = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/fleet', label: 'Fleet' },
  { href: '/dashboard/policy', label: 'Policy' },
  { href: '/dashboard/settings', label: 'Settings' },
  { href: '/dashboard/connect', label: 'Connect MastyffAi' },
];

export function DashboardNav() {
  return (
    <nav className="dashboard-nav">
      <div className="brand">
        <Link href="/dashboard">MCP Mastyff AI Cloud</Link>
      </div>
      <div className="nav-links">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
