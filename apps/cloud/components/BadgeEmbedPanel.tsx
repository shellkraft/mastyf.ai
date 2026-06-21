'use client';

import { useState } from 'react';

type Props = {
  markdown: string;
  html: string;
};

export function BadgeEmbedPanel({ markdown, html }: Props) {
  const [copied, setCopied] = useState<'md' | 'html' | null>(null);

  const copy = async (text: string, kind: 'md' | 'html') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="badge-embed-panel">
      <div className="badge-embed-block">
        <div className="badge-embed-header">
          <strong>Markdown</strong>
          <button type="button" className="badge-copy-btn" onClick={() => void copy(markdown, 'md')}>
            {copied === 'md' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="badge-embed-code">{markdown}</pre>
      </div>
      <div className="badge-embed-block">
        <div className="badge-embed-header">
          <strong>HTML</strong>
          <button type="button" className="badge-copy-btn" onClick={() => void copy(html, 'html')}>
            {copied === 'html' ? 'Copied' : 'Copy'}
          </button>
        </div>
        <pre className="badge-embed-code">{html}</pre>
      </div>
    </div>
  );
}
