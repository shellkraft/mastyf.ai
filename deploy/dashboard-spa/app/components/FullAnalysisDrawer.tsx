'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  downloadFullAnalysis,
  fetchFullAnalysis,
  type MastyffAiFullAnalysisResponse,
} from '@/lib/mastyff-ai-api';
import { useCurrentWindowDays } from './dashboard/DashboardWindowContext';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';

type Props = {
  open: boolean;
  onClose: () => void;
  proxyOnline: boolean | null;
};

function verdictTone(v?: string): 'success' | 'warn' | 'danger' | 'neutral' {
  if (v === 'healthy') return 'success';
  if (v === 'attention') return 'warn';
  if (v === 'critical') return 'danger';
  return 'neutral';
}

function renderMarkdownSimple(md: string): ReactNode {
  const lines = md.split('\n');
  const nodes: ReactNode[] = [];
  let list: string[] = [];
  const flushList = (key: string) => {
    if (!list.length) return;
    nodes.push(
      <ul key={key} className="insight-callout-list">
        {list.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  lines.forEach((line, i) => {
    if (line.startsWith('- ')) {
      list.push(line.slice(2));
      return;
    }
    flushList(`list-${i}`);
    if (line.startsWith('## ')) {
      nodes.push(
        <h4 key={`h-${i}`} style={{ marginTop: 16, marginBottom: 8 }}>
          {line.slice(3)}
        </h4>,
      );
    } else if (line.trim()) {
      nodes.push(
        <p key={`p-${i}`} className="briefing-hero-lead" style={{ marginBottom: 8 }}>
          {line}
        </p>,
      );
    }
  });
  flushList('list-end');
  return nodes;
}

export function FullAnalysisDrawer({ open, onClose, proxyOnline }: Props) {
  const { windowDays } = useCurrentWindowDays();
  const [analysis, setAnalysis] = useState<MastyffAiFullAnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useLlm, setUseLlm] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!open) return;
    if (proxyOnline === false) {
      setAnalysis(null);
      setError('Connect the proxy to generate a full analysis.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { analysis: data, error: apiError } = await fetchFullAnalysis(windowDays, useLlm);
      if (!data) {
        setAnalysis(null);
        setError(
          apiError
            || (proxyOnline === null
              ? 'Checking proxy connection…'
              : 'No analysis data — restart proxy after `pnpm build` with DASHBOARD_ENABLED=true.'),
        );
      } else {
        setAnalysis(data);
        setError('');
      }
    } finally {
      setLoading(false);
    }
  }, [open, windowDays, useLlm, proxyOnline]);

  useEffect(() => {
    if (open) void load();
  }, [load, open]);

  const onCopy = async () => {
    const text = analysis?.markdown || analysis?.plainEnglishSummary || '';
    if (text) await navigator.clipboard.writeText(text);
  };

  const onDownload = async () => {
    setExporting(true);
    try {
      await downloadFullAnalysis(windowDays, useLlm);
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="drawer-overlay" role="dialog" aria-modal="true" aria-labelledby="full-analysis-title">
      <div className="drawer-panel drawer-panel-wide">
        <header className="drawer-header">
          <div>
            <h3 id="full-analysis-title">Full analysis (plain English)</h3>
            <p className="muted" style={{ margin: 0 }}>
              {windowDays}-day window · {useLlm ? 'Ollama narrative when available' : 'measured facts only'}
            </p>
          </div>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="drawer-body">
          <div className="btn-row" style={{ marginBottom: 12 }}>
            <Button variant="secondary" size="sm" disabled={loading} onClick={() => void load()}>
              {loading ? 'Generating…' : 'Refresh'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setUseLlm((v) => !v)}>
              {useLlm ? 'Facts only' : 'Use Ollama'}
            </Button>
            <Button variant="secondary" size="sm" disabled={!analysis} onClick={() => void onCopy()}>
              Copy
            </Button>
            <Button variant="secondary" size="sm" disabled={exporting || !analysis} onClick={() => void onDownload()}>
              {exporting ? 'Downloading…' : 'Download .md'}
            </Button>
          </div>

          {loading ? <p className="muted">Building full analysis… this may take up to 45s with Ollama.</p> : null}
          {error ? <p className="hint" style={{ color: 'var(--danger)' }}>{error}</p> : null}

          {analysis && !loading ? (
            <>
              <div className="briefing-hero" style={{ marginBottom: 16 }}>
                <Badge tone={verdictTone(analysis.verdict)}>{analysis.verdict || 'unknown'}</Badge>
                {analysis.source === 'llm' ? (
                  <span className="muted" style={{ marginLeft: 8 }}>
                    AI narrative ({analysis.model || 'ollama'})
                  </span>
                ) : (
                  <span className="muted" style={{ marginLeft: 8 }}>
                    Measured facts
                  </span>
                )}
                <p className="briefing-hero-lead" style={{ marginTop: 12 }}>
                  {analysis.plainEnglishSummary}
                </p>
              </div>
              <div className="plain-english-report">
                {analysis.narrative ? (
                  <>
                    <h4>Plain-English briefing</h4>
                    <p className="briefing-hero-lead" style={{ whiteSpace: 'pre-wrap' }}>
                      {analysis.narrative}
                    </p>
                  </>
                ) : null}
                {analysis.markdown ? renderMarkdownSimple(analysis.markdown) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
