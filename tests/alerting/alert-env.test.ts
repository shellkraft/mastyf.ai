import { afterEach, describe, expect, it } from 'vitest';
import {
  getAlertDestinationsForLogging,
  getPagerDutyRoutingKey,
  getSlackWebhookUrl,
  isAppAlertingConfigured,
} from '../../src/alerting/alert-env.js';

const ENV_KEYS = [
  'ALERT_SLACK_WEBHOOK',
  'ALERT_WEBHOOK_URL',
  'MASTYF_AI_INCIDENT_WEBHOOK_URL',
  'ALERT_PAGERDUTY_KEY',
  'MASTYF_AI_INCIDENT_PAGERDUTY_KEY',
  'ALERT_GENERIC_WEBHOOK',
] as const;

const saved: Record<string, string | undefined> = {};

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function clearAlertEnv(): void {
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
}

describe('alert-env', () => {
  it('prefers ALERT_SLACK_WEBHOOK over legacy incident webhook', () => {
    clearAlertEnv();
    process.env.ALERT_SLACK_WEBHOOK = 'https://hooks.slack.com/slack';
    process.env.MASTYF_AI_INCIDENT_WEBHOOK_URL = 'https://hooks.slack.com/legacy';
    expect(getSlackWebhookUrl()).toBe('https://hooks.slack.com/slack');
  });

  it('falls back ALERT_WEBHOOK_URL then MASTYF_AI_INCIDENT_WEBHOOK_URL', () => {
    clearAlertEnv();
    process.env.ALERT_WEBHOOK_URL = 'https://discord.com/api/webhooks/x';
    expect(getSlackWebhookUrl()).toBe('https://discord.com/api/webhooks/x');

    delete process.env.ALERT_WEBHOOK_URL;
    process.env.MASTYF_AI_INCIDENT_WEBHOOK_URL = 'https://hooks.slack.com/incident';
    expect(getSlackWebhookUrl()).toBe('https://hooks.slack.com/incident');
  });

  it('prefers ALERT_PAGERDUTY_KEY over incident key', () => {
    clearAlertEnv();
    process.env.ALERT_PAGERDUTY_KEY = 'pd-canonical';
    process.env.MASTYF_AI_INCIDENT_PAGERDUTY_KEY = 'pd-legacy';
    expect(getPagerDutyRoutingKey()).toBe('pd-canonical');
  });

  it('reports configured destinations without leaking secrets', () => {
    clearAlertEnv();
    process.env.ALERT_SLACK_WEBHOOK = 'https://hooks.slack.com/secret';
    process.env.ALERT_PAGERDUTY_KEY = 'routing-key';
    expect(isAppAlertingConfigured()).toBe(true);
    expect(getAlertDestinationsForLogging()).toBe('slack,pagerduty');
  });
});
