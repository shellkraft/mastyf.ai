'use client';

import type { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import type { ChartMeta } from '@/lib/mastyf-ai-api';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { ChartFreshnessFooter } from './ChartFreshnessFooter';

type Props = {
  title: string;
  subtitle?: string;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyReason?: string;
  meta?: ChartMeta | null;
  sparse?: boolean;
  height?: number;
  actions?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
  /** When true, wraps children in ResponsiveContainer at `height`. */
  responsive?: boolean;
};

export function ChartPanel({
  title,
  subtitle,
  loading = false,
  empty = false,
  emptyTitle = 'No data',
  emptyMessage,
  emptyReason,
  meta,
  sparse,
  height = 280,
  actions,
  className,
  style,
  children,
  responsive = true,
}: Props) {
  const resolvedEmptyMessage = emptyReason ?? meta?.emptyReason ?? emptyMessage ?? 'No data in the selected window';
  const showFooter = !loading && !empty && (meta || sparse);

  return (
    <Card title={title} subtitle={subtitle} actions={actions} className={className} style={style} bodyPadding={!responsive}>
      <div className={responsive ? 'card-body' : 'card-body-no-padding'} style={responsive ? undefined : { padding: 'var(--space-4)' }}>
        {loading ? (
          <p className="text-sm text-muted" style={{ minHeight: height, display: 'flex', alignItems: 'center' }}>
            Loading chart…
          </p>
        ) : empty ? (
          <EmptyState title={emptyTitle} message={resolvedEmptyMessage} />
        ) : responsive ? (
          <div style={{ width: '100%', minHeight: height }}>
            <ResponsiveContainer width="100%" height={height}>
              {children as React.ReactElement}
            </ResponsiveContainer>
          </div>
        ) : (
          children
        )}
        {showFooter ? (
          <ChartFreshnessFooter meta={meta} sparse={sparse ?? meta?.sparse} />
        ) : null}
      </div>
    </Card>
  );
}
