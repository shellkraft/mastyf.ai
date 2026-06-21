'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BADGE_ALT_TEXT } from '@/lib/badge-brand';
import { buildBadgeEmbedMarkdown } from '@/lib/trust-badge-svg';

type Props = {
  variant?: 'hero' | 'compact';
};

/** Package lookup — same-origin relative URLs; GitHub-style badge preview. */
export function BadgeLookupWidget({ variant = 'compact' }: Props) {
  const [pkg, setPkg] = useState('');
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const trimmed = pkg.trim();
  const encoded = encodeURIComponent(trimmed);
  const verifyPath = `/certified/${encoded}`;
  const badgePath = `/api/v1/badge/${encoded}?style=github`;
  const cloudBase = origin || '';
  const markdown =
    cloudBase && trimmed
      ? buildBadgeEmbedMarkdown({ cloudBaseUrl: cloudBase, packageName: trimmed, style: 'github' })
      : `[![${BADGE_ALT_TEXT}](${badgePath})](${verifyPath})`;

  return (
    <div className={`socket-search ${variant === 'hero' ? 'socket-search-hero' : ''}`}>
      <label htmlFor="badge-pkg" className="socket-search-label">
        Look up an MCP server package
      </label>
      <div className="socket-search-row">
        <span className="socket-search-icon" aria-hidden>
          ⌕
        </span>
        <input
          id="badge-pkg"
          className="socket-search-input"
          value={pkg}
          onChange={(e) => setPkg(e.target.value)}
          placeholder="@scope/mcp-server"
          autoComplete="off"
        />
        <Link
          href={trimmed ? verifyPath : '#'}
          className="socket-search-btn"
          aria-disabled={!trimmed}
          onClick={(e) => {
            if (!trimmed) e.preventDefault();
          }}
        >
          View score
        </Link>
      </div>
      {trimmed ? (
      <div className="socket-search-preview">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={badgePath} alt={BADGE_ALT_TEXT} />
        <p className="socket-search-hint">
          Embed in README: <code>{markdown}</code>
        </p>
      </div>
      ) : null}
    </div>
  );
}
