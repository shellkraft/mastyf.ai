'use client';

import { useState } from 'react';

type Props = {
  markdown: string;
  verifyUrl?: string;
};

export function BadgeCopyButton({ markdown, verifyUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button type="button" className="btn text-xs" onClick={() => void copy()}>
        {copied ? 'Copied' : 'Copy badge'}
      </button>
      {verifyUrl ? (
        <a href={verifyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">
          Verify
        </a>
      ) : null}
    </div>
  );
}
