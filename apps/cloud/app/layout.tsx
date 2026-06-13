import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SessionProvider } from '@/components/SessionProvider';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://mastyff-ai-cloud.vercel.app'),
  title: 'MCP Mastyff AI — Stop AI agents from becoming your next breach vector',
  description:
    'Purpose-built MCP security proxy: 557+ adversarial fixtures, Security Swarm, LLM threat discovery, three-layer detection. 11k+ npm downloads. Enterprise-ready Helm deploy.',
  openGraph: {
    title: 'MCP Mastyff AI — Runtime security for MCP',
    description:
      'The defining product for AI agent security — inspect every tools/call, self-improving Security Swarm, HIPAA/PCI overlays.',
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
