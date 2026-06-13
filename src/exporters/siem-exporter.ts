/**
 * SIEM/CEF Exporter — streams policy decisions and security events in
 * Common Event Format (CEF) and Syslog RFC 5424 for Splunk, Elasticsearch,
 * QRadar, ArcSight, and generic SIEM platforms.
 *
 * Enterprise Phase 1 of 4 — Sub-Phase 1: SIEM/CEF Integration
 *
 * Environment:
 *   MASTYFF_AI_SIEM_ENABLED=true          — master enable
 *   MASTYFF_AI_SIEM_ENDPOINT              — Splunk HEC URL or Syslog host:port
 *   MASTYFF_AI_SIEM_PROTOCOL              — cef | syslog | splunk-hec (default: cef)
 *   MASTYFF_AI_SIEM_TOKEN                 — Splunk HEC token (if splunk-hec)
 *   MASTYFF_AI_SIEM_FACILITY              — syslog facility (default: local0)
 *   MASTYFF_AI_SIEM_SEVERITY_MAP          — JSON map of policy actions to severity
 *   MASTYFF_AI_SIEM_BATCH_SIZE            — max events per flush (default: 50)
 *   MASTYFF_AI_SIEM_FLUSH_INTERVAL_MS     — batch flush interval (default: 5000)
 */
import { Logger } from '../utils/logger.js';
import { StructuredLogger } from '../utils/structured-logger.js';

// ── Types ────────────────────────────────────────────────────────────

export interface SiemEvent {
  /** Event timestamp (ISO 8601). */
  timestamp: string;
  /** Policy decision action: block, flag, pass. */
  action: string;
  /** Policy rule that triggered. */
  rule: string;
  /** Reason for the decision. */
  reason: string;
  /** MCP server name. */
  serverName: string;
  /** Tool name. */
  toolName: string;
  /** Tenant identifier. */
  tenantId: string;
  /** Request ID. */
  requestId: string;
  /** Anomaly score (0–1) if available. */
  anomalyScore?: number;
  /** Threat intel reference if applicable. */
  threatIntelRef?: string;
  /** Source IP or client identifier. */
  clientIp?: string;
  /** Agent identity. */
  agentIdentity?: string;
  /** Additional context. */
  extra?: Record<string, unknown>;
}

export interface SiemConfig {
  enabled: boolean;
  protocol: 'cef' | 'syslog' | 'splunk-hec';
  endpoint: string;
  token?: string;
  facility: string;
  batchSize: number;
  flushIntervalMs: number;
  severityMap: Record<string, string>;
}

// ── Configuration ────────────────────────────────────────────────────

function loadSiemConfig(): SiemConfig {
  const rawMap = process.env['MASTYFF_AI_SIEM_SEVERITY_MAP'];
  let severityMap: Record<string, string> = {
    block: 'High',
    flag: 'Medium',
    pass: 'Low',
  };
  if (rawMap) {
    try {
      severityMap = { ...severityMap, ...JSON.parse(rawMap) };
    } catch { /* keep defaults */ }
  }

  return {
    enabled: process.env['MASTYFF_AI_SIEM_ENABLED'] === 'true',
    protocol: (process.env['MASTYFF_AI_SIEM_PROTOCOL'] as SiemConfig['protocol']) || 'cef',
    endpoint: process.env['MASTYFF_AI_SIEM_ENDPOINT'] || '',
    token: process.env['MASTYFF_AI_SIEM_TOKEN'],
    facility: process.env['MASTYFF_AI_SIEM_FACILITY'] || 'local0',
    batchSize: parseInt(process.env['MASTYFF_AI_SIEM_BATCH_SIZE'] || '50', 10),
    flushIntervalMs: parseInt(process.env['MASTYFF_AI_SIEM_FLUSH_INTERVAL_MS'] || '5000', 10),
    severityMap,
  };
}

// ── CEF Formatter (ArcSight Common Event Format) ─────────────────────

function escapeCefField(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

function formatCef(event: SiemEvent, config: SiemConfig): string {
  const severity = config.severityMap[event.action] || 'Medium';
  const deviceVendor = 'Mastyff AI';
  const deviceProduct = 'Mastyff AI Proxy';
  const deviceVersion = process.env['npm_package_version'] || '3.2.5';

  // CEF Header: CEF:0|Device Vendor|Device Product|Device Version|Signature ID|Signature Name|Severity
  const header = `CEF:0|${deviceVendor}|${deviceProduct}|${deviceVersion}|${event.rule}|Policy Decision|${severity}`;

  // CEF Extension fields
  const extensions: string[] = [
    `act=${escapeCefField(event.action)}`,
    `reason=${escapeCefField(event.reason)}`,
    `src=${escapeCefField(event.clientIp || event.requestId)}`,
    `dvc=${escapeCefField(event.serverName)}`,
    `dhost=${escapeCefField(event.serverName)}`,
    `cs1=${escapeCefField(event.toolName)}`,
    `cs1Label=toolName`,
    `cs2=${escapeCefField(event.tenantId)}`,
    `cs2Label=tenantId`,
    `cs3=${escapeCefField(event.agentIdentity || 'unknown')}`,
    `cs3Label=agentIdentity`,
    `requestId=${escapeCefField(event.requestId)}`,
    `deviceProcessName=mastyff-ai`,
  ];

  if (event.anomalyScore !== undefined) {
    extensions.push(`cn1=${event.anomalyScore.toFixed(3)}`);
    extensions.push(`cn1Label=anomalyScore`);
  }
  if (event.threatIntelRef) {
    extensions.push(`cs4=${escapeCefField(event.threatIntelRef)}`);
    extensions.push(`cs4Label=threatIntelRef`);
  }
  if (event.extra) {
    for (const [key, value] of Object.entries(event.extra)) {
      if (value !== undefined && value !== null) {
        extensions.push(`cs5=${escapeCefField(String(value))}`);
        extensions.push(`cs5Label=${key}`);
      }
    }
  }

  return `${header}|${extensions.join(' ')}`;
}

// ── Syslog RFC 5424 Formatter ────────────────────────────────────────

function formatSyslog(event: SiemEvent, config: SiemConfig): string {
  const severity = config.severityMap[event.action] || 'Medium';
  const severityMap: Record<string, number> = {
    Critical: 2,
    High: 4,
    Medium: 5,
    Low: 6,
  };
  const pri = (16 * 8) + (severityMap[severity] || 5); // facility * 8 + severity
  const hostname = process.env['HOSTNAME'] || 'mastyff-ai';
  const appName = 'mastyff-ai';
  const procid = process.pid.toString();
  const msgid = event.requestId;

  // RFC 5424: <PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID [SD] MSG
  const structuredData = [
    `action="${event.action}"`,
    `rule="${event.rule}"`,
    `reason="${event.reason}"`,
    `serverName="${event.serverName}"`,
    `toolName="${event.toolName}"`,
    `tenantId="${event.tenantId}"`,
    event.anomalyScore !== undefined ? `anomalyScore="${event.anomalyScore.toFixed(3)}"` : '',
  ].filter(Boolean).join(' ');

  return `<${pri}>1 ${event.timestamp} ${hostname} ${appName} ${procid} ${msgid} [mastyff-ai@48577 ${structuredData}] ${event.reason}`;
}

// ── Splunk HEC Formatter ─────────────────────────────────────────────

function formatSplunkHec(event: SiemEvent, _config: SiemConfig): string {
  const hecEvent = {
    time: Math.floor(new Date(event.timestamp).getTime() / 1000),
    host: event.serverName,
    source: 'mastyff-ai',
    sourcetype: 'mastyff_ai:policy',
    index: 'mastyff_ai',
    event: {
      action: event.action,
      rule: event.rule,
      reason: event.reason,
      serverName: event.serverName,
      toolName: event.toolName,
      tenantId: event.tenantId,
      requestId: event.requestId,
      anomalyScore: event.anomalyScore,
      threatIntelRef: event.threatIntelRef,
      clientIp: event.clientIp,
      agentIdentity: event.agentIdentity,
      extra: event.extra,
    },
  };
  return JSON.stringify(hecEvent);
}

// ── Batch Queue ──────────────────────────────────────────────────────

const eventQueue: SiemEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;

function getConfig(): SiemConfig {
  return loadSiemConfig();
}

export function enqueueSiemEvent(event: SiemEvent): void {
  const config = getConfig();
  if (!config.enabled || !config.endpoint) return;

  eventQueue.push(event);

  // Auto-flush if batch is full
  if (eventQueue.length >= config.batchSize) {
    void flushEvents();
  }

  // Start flush timer on first event
  if (!flushTimer && config.flushIntervalMs > 0) {
    flushTimer = setInterval(() => {
      void flushEvents();
    }, config.flushIntervalMs);
  }
}

async function flushEvents(): Promise<void> {
  if (eventQueue.length === 0) return;
  const config = getConfig();
  const batch = eventQueue.splice(0, config.batchSize);

  try {
    const payload = formatBatch(batch, config);
    await sendToSiem(payload, config);
  } catch (err) {
    Logger.warn(`[siem] Flush failed: ${err instanceof Error ? err.message : String(err)}`);
    // Re-queue failed events (up to 2x batch size to prevent memory leak)
    if (eventQueue.length < config.batchSize * 2) {
      eventQueue.unshift(...batch);
    }
  }
}

function formatBatch(batch: SiemEvent[], config: SiemConfig): string {
  switch (config.protocol) {
    case 'splunk-hec':
      return batch.map((e) => formatSplunkHec(e, config)).join('');
    case 'syslog':
      return batch.map((e) => formatSyslog(e, config)).join('\n');
    case 'cef':
    default:
      return batch.map((e) => formatCef(e, config)).join('\n');
  }
}

async function sendToSiem(payload: string, config: SiemConfig): Promise<void> {
  if (config.protocol === 'splunk-hec') {
    await sendSplunkHec(payload, config);
  } else if (config.protocol === 'syslog') {
    await sendSyslog(payload, config);
  } else {
    // CEF — fire-and-forget to endpoint via HTTP POST
    await sendHttpPost(payload, config, 'text/plain');
  }
}

async function sendHttpPost(payload: string, config: SiemConfig, contentType: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
        ...(config.token ? { 'Authorization': `Splunk ${config.token}` } : {}),
      },
      body: payload,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function sendSplunkHec(payload: string, config: SiemConfig): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Splunk ${config.token || ''}`,
      },
      body: payload,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Syslog uses UDP datagrams — no response expected. */
async function sendSyslog(payload: string, config: SiemConfig): Promise<void> {
  // Parse host:port from endpoint
  const match = config.endpoint.match(/^(?:syslog:\/\/)?([^:]+):(\d+)$/);
  if (!match) {
    Logger.warn(`[siem] Invalid syslog endpoint: ${config.endpoint}`);
    return;
  }
  const host = match[1];
  const port = parseInt(match[2], 10);

  const { createSocket } = await import('dgram');
  const client = createSocket('udp4');

  await new Promise<void>((resolve, reject) => {
    client.send(payload, port, host, (err) => {
      client.close();
      if (err) reject(err);
      else resolve();
    });
  });
}

// ── Public API ───────────────────────────────────────────────────────

/** Export a single policy decision event to SIEM. */
export function exportPolicyDecision(event: SiemEvent): void {
  if (!getConfig().enabled) return;

  enqueueSiemEvent(event);

  StructuredLogger.info({
    event: 'siem_export',
    action: event.action,
    rule: event.rule,
    serverName: event.serverName,
    toolName: event.toolName,
    tenantId: event.tenantId,
  });
}

/** Graceful shutdown — flush pending events. */
export async function shutdownSiemExporter(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  await flushEvents();
}

/** Test helper — reset queue and timer. */
export function resetSiemExporterForTests(): void {
  eventQueue.length = 0;
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}