# Compliance Control Mapping

Maps MCP Mastyf AI controls to SOC 2, NIST CSF, and OWASP MCP / LLM Top 10.

## Policy integrity and provenance

- Signed policy YAML (Ed25519) verified on load and reload
- Policy schema validation (`policy-schema.json`) in CI
- Four-eyes / operator RBAC for production policy mutations
- Audit hash chain for tamper-evident SIEM export

## Dual-control policy governance

- Autopilot shadow mode before enforce
- Threat Lab candidate accept/reject requires operator role
- Cloud org policy PUT restricted to admin/owner (operator+ for read/test)

## Control matrix

| Framework | Control | Implementation |
|-----------|---------|------------------|
| SOC 2 CC6.8 | Detection | Corpus eval, policy engine, semantic LLM gate |
| SOC 2 CC7.2 | Monitoring | Prometheus metrics, Grafana SLO dashboards |
| SOC 2 CC7.3 | Incident response | `incident-responder.ts`, PagerDuty/Slack webhooks |
| SOC 2 CC8.2 | Change management | Signed policy, CI required checks |
| NIST AC-3 | Access enforcement | OAuth, DPoP, dashboard RBAC, cloud API key scopes |
| NIST AU-2 | Audit events | `policy_decision` on all proxy transports |
| OWASP MCP | Tool poisoning | Rug-pull fingerprint, response gates |
| OWASP LLM | Prompt injection | Regex + semantic audit, encoding guard |

See [security/ATTACK_MATRIX.md](../security/ATTACK_MATRIX.md) and [compliance/EU_AI_ACT.md](./compliance/EU_AI_ACT.md).

Evidence generation: `pnpm enterprise:compliance-evidence` and `pnpm enterprise:evidence-check`.
