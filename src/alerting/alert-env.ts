/**
 * Unified alert destination resolution for webhook-alerter and incident-responder.
 */

function pickEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}

/** Slack/Discord incident webhook (canonical: ALERT_SLACK_WEBHOOK). */
export function getSlackWebhookUrl(): string {
  return pickEnv('ALERT_SLACK_WEBHOOK', 'ALERT_WEBHOOK_URL', 'MASTYF_AI_INCIDENT_WEBHOOK_URL');
}

/** PagerDuty Events API v2 routing key (canonical: ALERT_PAGERDUTY_KEY). */
export function getPagerDutyRoutingKey(): string {
  return pickEnv('ALERT_PAGERDUTY_KEY', 'MASTYF_AI_INCIDENT_PAGERDUTY_KEY');
}

export function isAppAlertingConfigured(): boolean {
  return Boolean(getSlackWebhookUrl() || getPagerDutyRoutingKey() || process.env['ALERT_GENERIC_WEBHOOK']?.trim());
}

/** Redacted summary for bootstrap logs (no secret values). */
export function getAlertDestinationsForLogging(): string {
  const parts: string[] = [];
  if (getSlackWebhookUrl()) parts.push('slack');
  if (getPagerDutyRoutingKey()) parts.push('pagerduty');
  if (process.env['ALERT_GENERIC_WEBHOOK']?.trim()) parts.push('generic');
  return parts.length > 0 ? parts.join(',') : 'none';
}
