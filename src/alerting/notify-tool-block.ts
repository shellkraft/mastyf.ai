import { alertPolicyBlock } from './webhook-alerter.js';

export interface NotifyToolBlockOptions {
  serverName: string;
  toolName: string;
  rule: string;
  reason: string;
  requestId?: string | number;
  anomalyScore?: number;
}

/** Push policy-block alerts to webhooks and incident automation (all proxy transports). */
export function notifyToolBlock(opts: NotifyToolBlockOptions): void {
  const { serverName, toolName, rule, reason, anomalyScore = 0.95 } = opts;
  const requestId = opts.requestId != null ? String(opts.requestId) : undefined;

  void alertPolicyBlock(serverName, toolName, rule, reason, requestId);

  void import('./incident-responder.js').then(({ checkAndRespondToCriticalBlock, trackBlockSpike }) => {
    trackBlockSpike(true);
    return checkAndRespondToCriticalBlock(reason, anomalyScore, toolName, serverName);
  }).catch(() => undefined);
}
