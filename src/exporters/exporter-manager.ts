/** Manages all SIEM/observability exporters */
import { Logger } from '../utils/logger.js';
import { sendWithRetry, flushExporterDlq } from './exporter-dlq.js';

export interface ExporterConfig {
  splunk?: { enabled: boolean; hecUrl: string; hecToken: string; index?: string };
  elastic?: { enabled: boolean; url: string; apiKey?: string; username?: string; password?: string };
  datadog?: { enabled: boolean; apiKey: string; site?: string };
  chronicle?: { enabled: boolean; customerId: string; serviceAccountKey: string };
  otel?: { enabled: boolean; endpoint: string };
}

export class ExporterManager {
  private config: ExporterConfig;
  private exporters: Array<{ name: string; send: (event: any) => Promise<void> }> = [];

  constructor() {
    this.config = {
      splunk: {
        enabled: process.env['MASTYFF_AI_SIEM_SPLUNK_ENABLED'] === 'true',
        hecUrl: process.env['MASTYFF_AI_SIEM_SPLUNK_HEC_URL'] || '',
        hecToken: process.env['MASTYFF_AI_SIEM_SPLUNK_HEC_TOKEN'] || '',
      },
      elastic: {
        enabled: process.env['MASTYFF_AI_SIEM_ELASTIC_ENABLED'] === 'true',
        url: process.env['MASTYFF_AI_SIEM_ELASTIC_URL'] || '',
        apiKey: process.env['MASTYFF_AI_SIEM_ELASTIC_API_KEY'],
        username: process.env['MASTYFF_AI_SIEM_ELASTIC_USERNAME'],
        password: process.env['MASTYFF_AI_SIEM_ELASTIC_PASSWORD'],
      },
      datadog: {
        enabled: process.env['MASTYFF_AI_SIEM_DATADOG_ENABLED'] === 'true',
        apiKey: process.env['MASTYFF_AI_SIEM_DATADOG_API_KEY'] || '',
        site: process.env['MASTYFF_AI_SIEM_DATADOG_SITE'] || 'datadoghq.com',
      },
      chronicle: {
        enabled: process.env['MASTYFF_AI_SIEM_CHRONICLE_ENABLED'] === 'true',
        customerId: process.env['MASTYFF_AI_SIEM_CHRONICLE_CUSTOMER_ID'] || '',
        serviceAccountKey: process.env['MASTYFF_AI_SIEM_CHRONICLE_SA_KEY'] || '',
      },
      otel: {
        enabled: process.env['MASTYFF_AI_SIEM_OTEL_ENABLED'] === 'true',
        endpoint: process.env['MASTYFF_AI_SIEM_OTEL_ENDPOINT'] || 'http://localhost:4318/v1/logs',
      },
    };
  }

  async start(): Promise<void> {
    this.exporters = [];
    let count = 0;

    if (this.config.splunk?.enabled) {
      if (!this.config.splunk.hecUrl || !this.config.splunk.hecToken) {
        Logger.warn('[ExporterManager] Splunk enabled but missing hecUrl or hecToken, skipping');
      } else {
      this.exporters.push({
        name: 'splunk',
        send: async (event) => {
          await this.sendToSplunk(event);
        },
      });
      count++;
      } // end else (credentials present)
    }

    if (this.config.elastic?.enabled) {
      this.exporters.push({
        name: 'elastic',
        send: async (event) => {
          await this.sendToElastic(event);
        },
      });
      count++;
    }

    if (this.config.datadog?.enabled) {
      this.exporters.push({
        name: 'datadog',
        send: async (event) => {
          await this.sendToDatadog(event);
        },
      });
      count++;
    }

    if (this.config.chronicle?.enabled) {
      this.exporters.push({
        name: 'chronicle',
        send: async (event) => {
          await this.sendToChronicle(event);
        },
      });
      count++;
    }

    if (this.config.otel?.enabled) {
      this.exporters.push({
        name: 'otel',
        send: async (event) => {
          await this.sendToOtel(event);
        },
      });
      count++;
    }

    Logger.info(`[ExporterManager] Started with ${count} exporters`);
    if (process.env['MASTYFF_AI_EXPORTER_DLQ_FLUSH'] !== 'false') {
      void this.flushDlq();
    }
  }

  async export(event: { type: string; payload: any; timestamp: string }): Promise<void> {
    await Promise.allSettled(
      this.exporters.map((e) =>
        sendWithRetry(e.name, () => e.send(event), event),
      ),
    );
  }

  async flushDlq(): Promise<number> {
    const senders: Record<string, (ev: { type: string; payload: unknown; timestamp: string }) => Promise<void>> = {};
    for (const e of this.exporters) {
      senders[e.name] = (ev) => e.send(ev);
    }
    return flushExporterDlq(senders);
  }

  private async sendToSplunk(event: any): Promise<void> {
    const cfg = this.config.splunk!;
    try {
      const response = await fetch(`${cfg.hecUrl}/services/collector/event`, {
        method: 'POST',
        headers: {
          'Authorization': `Splunk ${cfg.hecToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          time: Date.now() / 1000,
          host: process.env['HOSTNAME'] || 'unknown',
          source: 'mastyff-ai',
          sourcetype: '_json',
          index: cfg.index || 'main',
          event,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  private async sendToElastic(event: any): Promise<void> {
    const cfg = this.config.elastic!;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (cfg.apiKey) headers['Authorization'] = `ApiKey ${cfg.apiKey}`;
      else if (cfg.username) {
        headers['Authorization'] = 'Basic ' + Buffer.from(`${cfg.username}:${cfg.password || ''}`).toString('base64');
      }

      const res = await fetch(`${cfg.url}/mastyff-ai-${new Date().toISOString().split('T')[0]}/_doc`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ '@timestamp': event.timestamp, ...event }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  private async sendToDatadog(event: any): Promise<void> {
    const cfg = this.config.datadog!;
    try {
      const res = await fetch(`https://http-intake.logs.${cfg.site}/v1/input`, {
        method: 'POST',
        headers: {
          'DD-API-KEY': cfg.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ddsource: 'mastyff-ai',
          ddtags: `instance:${process.env['MASTYFF_AI_INSTANCE_ID'] || 'default'}`,
          hostname: process.env['HOSTNAME'] || 'unknown',
          service: 'mastyff-ai',
          message: JSON.stringify(event.payload),
          ...event,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  private async sendToChronicle(event: any): Promise<void> {
    try {
      // Chronicle Ingestion API expects UDM format
      const res = await fetch('https://chronicle.googleapis.com/v1alpha/ingestion/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: this.config.chronicle!.customerId,
          events: [{
            metadata: {
              event_timestamp: new Date(event.timestamp).toISOString(),
              event_type: 'MASTYFF_AI_EVENT',
            },
            additional: event.payload,
          }],
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  private async sendToOtel(event: any): Promise<void> {
    try {
      const res = await fetch(this.config.otel!.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceLogs: [{
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'mastyff-ai' } },
              ],
            },
            scopeLogs: [{
              logRecords: [{
                timeUnixNano: String(Date.now() * 1_000_000),
                severityNumber: 9,
                body: { stringValue: JSON.stringify(event) },
              }],
            }],
          }],
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err: unknown) {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }
}