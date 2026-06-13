'use client';

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { agenticPost } from '@/lib/mastyff-ai-api';

export type ActionResult = {
  id: string;
  label: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  at: string;
};

type AgenticActionContextValue = {
  busy: string;
  toast: string | null;
  toastError: boolean;
  results: Record<string, ActionResult>;
  runAction: (actionId: string, label: string, path: string, body?: Record<string, unknown>) => Promise<void>;
  clearToast: () => void;
  clearResult: (actionId: string) => void;
};

const AgenticActionContext = createContext<AgenticActionContextValue | null>(null);

export function AgenticActionProvider({ children, onRefresh }: { children: ReactNode; onRefresh?: () => void }) {
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);
  const [results, setResults] = useState<Record<string, ActionResult>>({});

  const clearToast = useCallback(() => {
    setToast(null);
    setToastError(false);
  }, []);

  const clearResult = useCallback((actionId: string) => {
    setResults((prev) => {
      const next = { ...prev };
      delete next[actionId];
      return next;
    });
  }, []);

  const runAction = useCallback(
    async (actionId: string, label: string, path: string, body?: Record<string, unknown>) => {
      if (busy) return;
      setBusy(actionId);
      setToast(null);
      const res = await agenticPost(path, body);
      const entry: ActionResult = {
        id: actionId,
        label,
        ok: res.ok,
        data: res.data,
        error: res.error,
        at: new Date().toISOString(),
      };
      setResults((prev) => ({ ...prev, [actionId]: entry }));
      setToast(res.ok ? `${label} completed` : res.error || `${label} failed`);
      setToastError(!res.ok);
      setBusy('');
      window.setTimeout(() => setToast(null), 5000);
      onRefresh?.();
      const el = document.getElementById(`agentic-action-${actionId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    [busy, onRefresh],
  );

  return (
    <AgenticActionContext.Provider
      value={{ busy, toast, toastError, results, runAction, clearToast, clearResult }}
    >
      {children}
    </AgenticActionContext.Provider>
  );
}

export function useAgenticActions() {
  const ctx = useContext(AgenticActionContext);
  if (!ctx) throw new Error('useAgenticActions requires AgenticActionProvider');
  return ctx;
}

export function AgenticToast() {
  const { toast, toastError, clearToast } = useAgenticActions();
  if (!toast) return null;
  return (
    <div
      className={`agentic-toast ${toastError ? 'agentic-toast-error' : 'agentic-toast-ok'}`}
      role="status"
    >
      <span>{toast}</span>
      <button type="button" className="agentic-toast-dismiss" onClick={clearToast}>
        ✕
      </button>
    </div>
  );
}

export function AgenticInlineResult({ actionId }: { actionId: string }) {
  const { results, clearResult } = useAgenticActions();
  const r = results[actionId];
  if (!r) return null;
  return (
    <div id={`agentic-action-${actionId}`} className="agentic-inline-result">
      <div className="agentic-inline-result-head">
        <span className={r.ok ? 'gate-pass' : 'gate-fail'}>{r.ok ? 'Success' : 'Failed'}</span>
        <button type="button" className="secondary btn-sm" onClick={() => clearResult(actionId)}>
          Dismiss
        </button>
      </div>
      {r.error ? <p className="hint agentic-inline-error">{r.error}</p> : null}
      <details className="agentic-raw-details">
        <summary>View raw response</summary>
        <pre className="agentic-raw-json">{JSON.stringify(r.data ?? r.error, null, 2)}</pre>
      </details>
    </div>
  );
}
