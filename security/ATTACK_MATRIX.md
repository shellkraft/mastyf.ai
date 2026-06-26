# OWASP MCP Top 10 & LLM Top 10 — Attack Matrix

Maps threats to MCP Mastyf AI controls and tests. Defense Fabric phases in [docs/DEFENSE_FABRIC.md](../docs/DEFENSE_FABRIC.md).

| ID | Threat | Fabric phase | Control | Test |
|----|--------|--------------|---------|------|
| MCP-01 | Tool poisoning | Lifecycle + Egress | Rug-pull fingerprint, tools/list hash | `tests/proxy/rug-pull.test.ts` |
| MCP-02 | Privilege abuse | Ingress + Policy | OAuth, RBAC scopes, DPoP | `tests/auth/*` |
| MCP-03 | Data exfiltration | Egress | Response gates, egress policy | corpus exfil fixtures |
| MCP-04 | Prompt injection | Intelligence | Regex + semantic audit | corpus 154-attack |
| MCP-05 | Insecure transport | Ingress | TLS upstream enforcement | `packages/server/tests/http-proxy-security.test.ts` |
| MCP-06 | Log injection | Egress | Structured JSON logger | audit schema |
| MCP-07 | Denial of service | Ingress + Economics | Rate limits, inflight cap, spend pool | `tests/enterprise/preflight-matrix.test.ts` |
| MCP-08 | Supply chain | Policy | SBOM, signed policy, Dependabot | CI audit job |
| MCP-09 | Insufficient logging | Egress | `policy_decision` all transports | integration tests |
| MCP-10 | Shadow MCP | Ingress | Gateway auth required | enterprise preflight |

## OWASP LLM Top 10 (selected)

| ID | Threat | Control |
|----|--------|---------|
| LLM01 | Prompt injection | Semantic gate + encoding guard |
| LLM02 | Insecure output | Response security gate |
| LLM06 | Sensitive disclosure | PCI/HIPAA policy templates |
| LLM08 | Excessive agency | Policy block mode, tool allowlists |

Run corpus: `pnpm eval`. Red team: `pnpm harness:premortem-profiles`.
