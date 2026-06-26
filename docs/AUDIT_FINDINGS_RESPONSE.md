# Audit Findings Response — MCP Proxy Code Review (M-001–M-017)

Generated from remediation of [1000243551.pdf](/Users/rudraneeldas/Downloads/1000243551.pdf) (mastyf.ai scope only).

| ID | Severity | Status | Evidence |
|----|----------|--------|----------|
| M-001 | CRITICAL | **Fixed** | [`src/utils/redis-semantic-queue.ts`](../src/utils/redis-semantic-queue.ts), [`packages/core/src/semantic-queue.ts`](../packages/core/src/semantic-queue.ts), [`tests/utils/redis-semantic-queue.test.ts`](../tests/utils/redis-semantic-queue.test.ts) |
| M-002 | HIGH | **Fixed** | `semantic_layer_active` in [`src/ai/sync-semantic-request.ts`](../src/ai/sync-semantic-request.ts), [`tests/ai/semantic-layer-active.test.ts`](../tests/ai/semantic-layer-active.test.ts) |
| M-003 | MEDIUM | **Fixed** | Eval pinning in [`src/policy/policy-watcher.ts`](../src/policy/policy-watcher.ts), deferred swap in [`src/proxy/proxy-server.ts`](../src/proxy/proxy-server.ts) |
| M-004 | MEDIUM | **Fixed** | [`src/policy/entropy-policy.ts`](../src/policy/entropy-policy.ts), [`tests/policy/entropy-policy.test.ts`](../tests/policy/entropy-policy.test.ts) |
| M-005 | LOW | **Fixed** | Response confusables in [`src/utils/response-decode.ts`](../src/utils/response-decode.ts), [`tests/policy/response-confusables.test.ts`](../tests/policy/response-confusables.test.ts) |
| M-006 | CRITICAL | **Fixed** | [`src/proxy/http-proxy-server.ts`](../src/proxy/http-proxy-server.ts), [`docs/SECURITY_ADVISORY_HTTP_PROXY.md`](SECURITY_ADVISORY_HTTP_PROXY.md), [`tests/proxy/http-proxy-server.test.ts`](../tests/proxy/http-proxy-server.test.ts) |
| M-007 | HIGH | **Fixed** | Shared pipeline [`src/proxy/semantic-proxy-hooks.ts`](../src/proxy/semantic-proxy-hooks.ts), [`tests/proxy/transport-parity-integration.test.ts`](../tests/proxy/transport-parity-integration.test.ts) |
| M-008 | HIGH | **Fixed** | Google `countTokens` in [`src/utils/token-counter.ts`](../src/utils/token-counter.ts) |
| M-009 | MEDIUM | **Fixed** | Pre-forward budget in [`src/proxy/sse-proxy-server.ts`](../src/proxy/sse-proxy-server.ts) `_forwardToUpstream` |
| M-010 | MEDIUM | **Fixed** | Exponential backoff in [`src/utils/circuit-breaker.ts`](../src/utils/circuit-breaker.ts), [`src/ai/semantic-circuit-breaker.ts`](../src/ai/semantic-circuit-breaker.ts) |
| M-011 | LOW | **Fixed** | Ollama warning in [`src/utils/enterprise-bootstrap.ts`](../src/utils/enterprise-bootstrap.ts) |
| M-012 | HIGH | **Fixed** | [`src/policy/policy-load-metrics.ts`](../src/policy/policy-load-metrics.ts), [`tests/policy/policy-watcher-reload.test.ts`](../tests/policy/policy-watcher-reload.test.ts) |
| M-013 | MEDIUM | **Fixed** | [`tests/policy/policy-engine-rbac-clientid.test.ts`](../tests/policy/policy-engine-rbac-clientid.test.ts) |
| M-014 | MEDIUM | **Fixed** | [`src/clients/nvd-client.ts`](../src/clients/nvd-client.ts) |
| M-015 | LOW | **Fixed** | [`tests/utils/tracing-integration.test.ts`](../tests/utils/tracing-integration.test.ts) |
| M-016 | INFO | **Fixed** | [`src/utils/tribunal-sla.ts`](../src/utils/tribunal-sla.ts), `pendingTribunalCount` in [`src/ai/swarm-debate-tribunal.ts`](../src/ai/swarm-debate-tribunal.ts) |
| M-017 | HIGH | **Fixed** | [`apps/cloud/lib/rate-limit.ts`](../apps/cloud/lib/rate-limit.ts), [`apps/cloud/tests/rate-limit.test.ts`](../apps/cloud/tests/rate-limit.test.ts) |

## Prior audit items (16 findings)

See table below for earlier cloud/proxy remediation.

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 1 | Certifications 500 without DATABASE_URL | **Fixed** | [`apps/cloud/lib/cloud-db-guard.ts`](../apps/cloud/lib/cloud-db-guard.ts) |
| 2 | Badge API slow / no rate limit | **Fixed** | [`apps/cloud/lib/rate-limit.ts`](../apps/cloud/lib/rate-limit.ts) |
| 3 | ReadResource swallows DB errors | **Fixed** | [`src/index.ts`](../src/index.ts) |
| 4 | Policy regex ReDoS gaps | **Fixed** | [`src/policy/threat-intel-guard.ts`](../src/policy/threat-intel-guard.ts) |
| 5 | proxy-server 50+ imports | **Partial** | CVE gate lazy-loaded |
| 6 | Federated learning dead code | **Fixed** | [`docs/EXPERIMENTAL_FEATURES.md`](EXPERIMENTAL_FEATURES.md) |
| 7 | evasion-attacks.json 662KB | **Closed** | Harness-only |
| 8 | Go ingress auth | **Remapped** | [`src/proxy/ingress-rate-limit.ts`](../src/proxy/ingress-rate-limit.ts) |
| 9 | Go global rate limit | **Remapped fixed** | [`src/proxy/ingress-rate-limit.ts`](../src/proxy/ingress-rate-limit.ts) |
| 10 | Go body limit | **Remapped** | TS proxy body caps |
| 11 | Session ID regex log injection | **N/A** | Not in repo |
| 12 | pricing loader TTL | **Closed** | [`src/clients/pricing-client.ts`](../src/clients/pricing-client.ts) |
| 13 | SSE buffer | **Remapped fixed** | [`src/proxy/sse-proxy-server.ts`](../src/proxy/sse-proxy-server.ts) |
| 14 | keyring hasher | **Closed** | [`apps/cloud/lib/api-keys.ts`](../apps/cloud/lib/api-keys.ts) |
| 15 | budget lease worker | **N/A** | [`src/services/tenant-budget.ts`](../src/services/tenant-budget.ts) |
| 16 | Deep-scan 501 on Vercel | **Fixed** | [`apps/cloud/lib/deep-scan-jobs.ts`](../apps/cloud/lib/deep-scan-jobs.ts) |

## P0 proxy hardening

| Item | Status | Evidence |
|------|--------|----------|
| Stdio line writer | **Fixed** | [`src/proxy/proxy-stdio-writer.ts`](../src/proxy/proxy-stdio-writer.ts) |
| JSON-RPC idempotency | **Fixed** | [`src/proxy/proxy-jsonrpc-response.ts`](../src/proxy/proxy-jsonrpc-response.ts) |
| Session auth scoping | **Fixed** | [`src/proxy/proxy-session-auth.ts`](../src/proxy/proxy-session-auth.ts) |
| Request context TTL | **Fixed** | [`src/proxy/proxy-request-context.ts`](../src/proxy/proxy-request-context.ts) |
