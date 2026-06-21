'use client';

import { useMemo, useState } from 'react';
import { BADGE_ALT_TEXT } from '@/lib/badge-brand';
import {
  TRUST_BADGE_STYLES,
  buildAllBadgeEmbeds,
  type BadgeEmbedPlatform,
  type TrustBadgeStyle,
} from '@/lib/trust-badge-svg';

type Props = {
  cloudBaseUrl: string;
  packageName: string;
  /** Bust browser cache for the on-page preview after a fresh scan. */
  badgeCacheKey?: string;
};

const PLATFORMS: { id: BadgeEmbedPlatform; label: string }[] = [
  { id: 'github', label: 'GitHub / Markdown' },
  { id: 'html', label: 'HTML' },
  { id: 'rst', label: 'reStructuredText' },
  { id: 'bbcode', label: 'BBCode (forums)' },
  { id: 'asciidoc', label: 'AsciiDoc' },
];

export function BadgeEmbedGallery({ cloudBaseUrl, packageName, badgeCacheKey }: Props) {
  const [style, setStyle] = useState<TrustBadgeStyle>('github');
  const [platform, setPlatform] = useState<BadgeEmbedPlatform>('github');
  const [copied, setCopied] = useState(false);

  const variants = useMemo(
    () => buildAllBadgeEmbeds(cloudBaseUrl, packageName),
    [cloudBaseUrl, packageName],
  );

  const current = variants.find((v) => v.style === style && v.platform === platform)
    ?? variants.find((v) => v.style === style && v.platform === 'github')
    ?? variants[0]!;

  const styleMeta = TRUST_BADGE_STYLES.find((s) => s.id === style);
  const previewBase = cloudBaseUrl.replace(/\/$/, '');
  const previewUrl = badgeCacheKey
    ? `${previewBase}${current.badgePath}&at=${encodeURIComponent(badgeCacheKey)}`
    : `${previewBase}${current.badgePath}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="badge-embed-gallery">
      <div className="badge-embed-preview-row">
        <div className="badge-embed-preview-box">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={`${BADGE_ALT_TEXT} — ${styleMeta?.label ?? style}`} />
        </div>
        <div className="badge-embed-style-grid">
          {TRUST_BADGE_STYLES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`badge-style-chip${style === s.id ? ' active' : ''}`}
              onClick={() => setStyle(s.id)}
              title={s.description}
            >
              <strong>{s.label}</strong>
              <span>{s.platform}</span>
            </button>
          ))}
        </div>
      </div>

      {styleMeta ? (
        <p className="badge-embed-desc">{styleMeta.description}</p>
      ) : null}

      <div className="badge-embed-platform-tabs">
        {PLATFORMS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`badge-platform-tab${platform === p.id ? ' active' : ''}`}
            onClick={() => setPlatform(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="badge-embed-block">
        <div className="badge-embed-header">
          <strong>{current.platformLabel} snippet</strong>
          <button type="button" className="badge-copy-btn" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="badge-embed-code">{current.snippet}</pre>
      </div>
    </div>
  );
}
