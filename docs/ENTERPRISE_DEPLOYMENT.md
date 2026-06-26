# Enterprise Deployment Guide

Production deployment for MCP Mastyf AI using Helm overlays, signed policy governance, and observability bundles.

## Helm overlays

```bash
helm upgrade --install mastyf-ai ./deploy/helm/mastyf-ai \
  -f deploy/helm/mastyf-ai/values.yaml \
  -f deploy/helm/mastyf-ai/values-enterprise.yaml \
  --set gateway.ingress.host=mastyf.example.com \
  --set secrets.existingSecret=mastyf-ai-secret
```

| Overlay | Purpose |
|---------|---------|
| `values.yaml` | Baseline single-replica dev/staging |
| `values-enterprise.yaml` | Production: 3 replicas, TLS ingress, mTLS upstream, SIEM, Redis required |
| `values-ha.yaml` | Multi-replica SQLite guard + Postgres enforcement |

## Signed policy governance

1. Export and sign policy: `node scripts/sign-policy.mjs default-policy.yaml`
2. Mount signed YAML + `.sig.json` via ConfigMap or ExternalSecrets
3. Enable `MASTYF_AI_STRICT_MODE=true` — unsigned policy changes are rejected at reload

## Four-eyes policy updates

Threat Lab and dashboard policy PUT require operator+ role. Production merges use PR + signed artifact; autopilot shadow→enforce stages require human approval (see `docs/compliance/EU_AI_ACT.md`).

## Environment matrix (enterprise)

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_URL` | Yes (multi-replica) | Session flow, rate limits, policy cache |
| `DATABASE_URL` | Yes | Postgres via PgBouncer `:6432` |
| `POLICY_AUDIT_ENABLED` | Yes | Policy decision audit trail |
| `MASTYF_AI_SIEM_SPLUNK_ENABLED` | One SIEM | Splunk HEC export |
| `MASTYF_AI_AUDIT_HASH_CHAIN` | Recommended | Tamper-evident audit chain |
| `MASTYF_AI_GLOBAL_RATE_LIMIT_REQUIRED` | Yes | Fail startup without Redis |
| `MASTYF_AI_AUTH_REQUIRED` | Gateway | OAuth on all ingress when multi-tenant |

## Prometheus Operator

1. Install Prometheus Operator (kube-prometheus-stack or standalone)
2. Enable `monitoring.serviceMonitor.enabled: true` and `monitoring.prometheusRule.enabled: true`
3. Import Grafana dashboards from ConfigMap `*-grafana-dashboard` (label `grafana_dashboard: "1"`)

Example PromQL:

```promql
sum(rate(mastyf_ai_proxy_requests_total{decision="block"}[5m]))
/ sum(rate(mastyf_ai_proxy_requests_total[5m]))
```

## OpenTelemetry / Jaeger

Set in enterprise overlay:

```yaml
monitoring:
  otel:
    enabled: true
    endpoint: http://otel-collector:4318
```

Local Jaeger:

```yaml
# docker-compose snippet
otel-collector:
  image: otel/opentelemetry-collector-contrib:latest
  ports: ["4318:4318"]
jaeger:
  image: jaegertracing/all-in-one:latest
  ports: ["16686:16686"]
```

## Production checklist

- [ ] Postgres + PgBouncer (not direct `:5432`)
- [ ] Redis Sentinel or cluster for HA
- [ ] Ingress TLS + upstream mTLS secrets mounted
- [ ] ExternalSecrets for SIEM tokens and dashboard keys
- [ ] PrometheusRule alerts routed to Alertmanager
- [ ] Backup CronJob PVC + optional S3 bucket
- [ ] `mastyf-ai doctor --validate-policy` passes in strict mode

See also: [REDIS_HA.md](./REDIS_HA.md), [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md), [ENTERPRISE_EVIDENCE_PACK.md](./ENTERPRISE_EVIDENCE_PACK.md).
