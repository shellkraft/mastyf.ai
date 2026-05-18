import {
  BarChart,
  Callout,
  Divider,
  Grid,
  H1,
  H2,
  LineChart,
  Stack,
  Stat,
  Table,
  Text,
} from 'cursor/canvas';

const D = {
  minuteLabels: [
    '0m', '4m', '8m', '12m', '16m', '20m', '24m', '28m', '32m', '36m', '40m', '44m', '48m', '51m',
  ],
  blockCounts: [3, 2, 3, 3, 3, 2, 2, 2, 3, 3, 2, 3, 3, 141],
  cumLabels: ['0m', '4m', '8m', '13m', '20m', '28m', '36m', '45m', '52m'],
  cumInstant: [0, 1, 5, 5, 5, 5, 5, 5, 5],
  cumBatch: [0, 0, 0, 0, 0, 0, 0, 0, 5],
  queueLabels: ['0m', '4m', '8m', '16m', '24m', '32m', '45m', '52m'],
  queueInstant: [0, 1, 5, 5, 5, 5, 5, 5],
  queueBatch: [0, 0, 0, 0, 0, 0, 0, 5],
  repeatTop: [
    { label: 'shell-guard · search', value: 45 },
    { label: 'sql-exfil · query', value: 27 },
    { label: 'sensitive-path · read_file', value: 24 },
    { label: 'dangerous-urls · puppeteer', value: 24 },
    { label: 'path-guard · read_file', value: 23 },
  ],
  latencyLabels: ['<1m', '1-3m', '3-5m', '5-10m', '>10m'],
  latencyInstant: [1, 1, 3, 0, 0],
  latencyBatch: [0, 0, 0, 0, 5],
  heatmapRows: [
    ['semantic-shell-guard', 'search', '101'],
    ['path-guard', 'read_file', '48'],
    ['sensitive-path', 'read_file', '50'],
    ['sql-exfil', 'query', '53'],
    ['block-dangerous-urls', 'puppeteer_navigate', '53'],
  ],
  headline: {
    instantSuggestions: 5,
    batchSuggestions: 5,
    medianInstantSec: 242,
    medianBatchSec: 3000,
    avgBlocksInstant: 3,
    avgBlocksBatch: 61,
  },
};

export default function AttackLearningEval() {
  const h = D.headline;
  return (
    <Stack gap={20}>
      <H1>Instant attack learning — enterprise stream eval</H1>
      <Text tone="secondary" size="small">
        Source: simulate-attack-learning-stream.ts · 305 blocked events · 52 min session · 2026-05-18
      </Text>

      <Grid columns={4} gap={12}>
        <Stat value={String(h.instantSuggestions)} label="Instant suggestions" tone="success" />
        <Stat value={`${h.medianInstantSec}s`} label="Median time-to-suggest (instant)" />
        <Stat value={`${h.medianBatchSec}s`} label="Median time-to-suggest (batch)" tone="warning" />
        <Stat value={`${h.avgBlocksInstant} vs ${h.avgBlocksBatch}`} label="Avg blocks to suggest" />
      </Grid>

      <Divider />

      <H2>Fig 1 — Blocked calls per minute (shared attack stream)</H2>
      <Text tone="secondary" size="small">
        Y-axis: block count · X-axis: simulated session minute
      </Text>
      <BarChart
        height={220}
        categories={D.minuteLabels}
        series={[{ name: 'Blocked tools/call', data: D.blockCounts }]}
      />

      <H2>Fig 2 — Cumulative unique rule×tool suggestions</H2>
      <Text tone="secondary" size="small">
        Y-axis: distinct groups with queued suggestions · X-axis: session time
      </Text>
      <LineChart
        height={220}
        categories={D.cumLabels}
        series={[
          { name: 'Instant learning', data: D.cumInstant, tone: 'success' },
          { name: 'Batch-only (30s debounce)', data: D.cumBatch, tone: 'warning' },
        ]}
        fill
      />

      <H2>Fig 3 — Repeat-attack clusters (5 min window)</H2>
      <Text tone="secondary" size="small">
        Y-axis: repeat count after first block · Top rule×tool pairs
      </Text>
      <BarChart
        height={240}
        horizontal
        categories={D.repeatTop.map((r) => r.label)}
        series={[{ name: 'Repeats within window', data: D.repeatTop.map((r) => r.value), tone: 'danger' }]}
      />

      <H2>Fig 4 — Time-to-suggestion distribution</H2>
      <Text tone="secondary" size="small">
        Y-axis: suggestion count · X-axis: latency bucket from first block
      </Text>
      <BarChart
        height={220}
        categories={D.latencyLabels}
        series={[
          { name: 'Instant', data: D.latencyInstant, tone: 'success' },
          { name: 'Batch-only', data: D.latencyBatch, tone: 'warning' },
        ]}
      />

      <H2>Fig 5 — Pending suggestion queue size</H2>
      <Text tone="secondary" size="small">
        Y-axis: queued attack-pattern suggestions · X-axis: session time
      </Text>
      <LineChart
        height={220}
        categories={D.queueLabels}
        series={[
          { name: 'Instant queue', data: D.queueInstant, tone: 'info' },
          { name: 'Batch queue', data: D.queueBatch, tone: 'neutral' },
        ]}
      />

      <Divider />

      <H2>Rule × tool block heatmap</H2>
      <Table
        headers={['Block rule', 'Tool', 'Block count']}
        rows={D.heatmapRows}
      />

      <Callout tone="success">
        Instant learning outperforms batch-only: ~12× lower median latency (242s vs 3000s) with the
        same 5 rule×tool discoveries; batch defers all suggestions until session-end debounce flush
        under continuous attack traffic.
      </Callout>
    </Stack>
  );
}
