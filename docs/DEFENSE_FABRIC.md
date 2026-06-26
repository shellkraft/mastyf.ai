# Mastyf Defense Fabric

Holistic MCP protection across registration, ingress, economics, policy, intelligence, egress, and learning — native to mastyf.ai (no external proxy dependencies).

## Six phases

| Phase | Controls |
|-------|----------|
| **1. Ingress** | TLS, OAuth/DPoP, JSON-RPC validation, body/field limits, ingress rate limits |
| **2. Economics** | Unified spend pool (tokens/min, USD/min, daily), loop anomaly guard |
| **3. Policy** | YAML/OPA/RBAC, session flow, CVE gate, certification |
| **4. Intelligence** | Argument scan, sync semantic gate, async semantic audit |
| **5. Upstream** | Trace propagation, streaming spend cutoff |
| **6. Egress** | Response DLP, rug-pull fingerprint, spend commit, audit |

Every `tools/call` on **all transports** (stdio, HTTP, SSE, streamable HTTP, WebSocket) flows through [`src/proxy/tool-call-defense-orchestrator.ts`](../src/proxy/tool-call-defense-orchestrator.ts).

## Deployment profiles

| Profile | Helm overlay | Behavior |
|---------|--------------|----------|
| **Max-security** (default enterprise) | `values-enterprise.yaml` | `MASTYF_AI_SEMANTIC_STRICT=true`, sync semantic LLM, full six phases |
| **Fast-path / throughput** | `values-throughput.yaml` | Policy + spend reserve; semantic async-only; optional split-plane edge |

```bash
# Enterprise
helm upgrade --install mastyf-ai ./deploy/helm/mastyf-ai \
  -f deploy/helm/mastyf-ai/values.yaml \
  -f deploy/helm/mastyf-ai/values-enterprise.yaml

# Throughput
helm upgrade --install mastyf-ai ./deploy/helm/mastyf-ai \
  -f deploy/helm/mastyf-ai/values.yaml \
  -f deploy/helm/mastyf-ai/values-throughput.yaml
```

## Lifecycle assurance

| Gate | Env | Module |
|------|-----|--------|
| Rug-pull drift | block mode | `rug-pull-transport.ts`, `rug-pull-cluster.ts` |
| CVE | `MASTYF_AI_BLOCK_ON_CVE=true` | `cve-gate.ts` |
| Registration corpus | `MASTYF_AI_BLOCK_CRITICAL_TOOLS=true` | `tool-registration-gate.ts` |

## Split-plane edge (optional)

[`apps/proxy-core/`](../apps/proxy-core/) consumes signed **compiled rules v2** from the control plane (`tokensPerMinuteCap`, `usdPerMinuteCap`, tool denylist). Deep inspection remains in the TypeScript proxy.

## Key environment variables

| Variable | Purpose |
|----------|---------|
| `MASTYF_AI_SEMANTIC_STRICT` | Fail-closed when semantic LLM unavailable |
| `MASTYF_AI_TENANT_TOKENS_PER_MIN` | Unified spend pool tokens/min |
| `MASTYF_AI_BLOCK_CRITICAL_TOOLS` | Block tools flagged critical at `tools/list` scan |
| `MASTYF_AI_REQUIRE_SIGNED_COMPILED_RULES` | Edge enforcer requires signed rules bundle |

Evidence: `pnpm enterprise:evidence-check` · OWASP mapping: [security/ATTACK_MATRIX.md](../security/ATTACK_MATRIX.md)
