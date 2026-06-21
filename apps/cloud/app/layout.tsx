import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SessionProvider } from '@/components/SessionProvider';
import { NPM_PRODUCT_NAME, PRODUCTION_SITE_URL, SITE_NAME } from '@/lib/product-links';
import { resolveSiteUrl } from '@/lib/site-url';
import './globals.css';

const siteUrl = resolveSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl || PRODUCTION_SITE_URL),
  title: `${SITE_NAME} — MCP security scores & cloud console`,
  description:
    `${SITE_NAME} helps teams score MCP packages, embed trust badges, and manage policy in a free cloud console. Built on ${NPM_PRODUCT_NAME}, the open-source MCP proxy on npm.`,
  openGraph: {
    title: `${SITE_NAME} — Know which MCP servers are safe to trust`,
    description:
      'Look up any npm MCP package for an instant 0–100 trust score. Free cloud console for policy and fleet management.',
    images: ['/assets/security-swarm-architecture.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
