# Incident Response Runbook

## Triggers

- Prometheus alert `MastyfAiHighBlockRate`
- PagerDuty from `checkAndRespondToCriticalBlock`
- Manual SIEM correlation

## Steps

1. Acknowledge incident in PagerDuty/Slack (`ALERT_SLACK_WEBHOOK` / `ALERT_PAGERDUTY_KEY`)
2. Check dashboard `/api/security` and recent `policy_decision` logs
3. Identify tenant + rule causing spike
4. If false positive: switch policy to flag mode or disable rule via signed policy rollback
5. If true positive: keep block mode; notify tenant admin
6. Post-incident: update corpus fixture if gap found

Env: `ALERT_SLACK_WEBHOOK`, `ALERT_PAGERDUTY_KEY` (Helm ExternalSecrets vault paths `alert-slack-webhook`, `alert-pagerduty-key`).
