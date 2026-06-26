# OWASP MCP Top 10 & LLM Top 10 — Attack Matrix

Maps threats to MCP Mastyf AI controls and tests.

## OWASP MCP Top 10

| ID | Threat | Control | Test |
|----|--------|---------|------|
| MCP-01 | Tool poisoning | Rug-pull fingerprint, tools/list hash | `tests/proxy/rug-pull.test.ts` |
| MCP-02 | Privilege abuse | OAuth, RBAC scopes, DPoP | `tests/auth/*` |
| MCP-03 | Data exfiltration | Response gates, egress policy | corpus exfil fixtures |
| MCP-04 | Prompt injection | Regex + semantic audit | corpus 154-attack |
| MCP-05 | Insecure transport | TLS upstream enforcement | `packages/server/tests/http-proxy-security.test.ts` |
| MCP-06 | Log injection | Structured JSON logger | audit schema |
| MCP-07 | Denial of service | Rate limits, inflight cap | `tests/enterprise/preflight-matrix.test.ts` |
| MCP-08 | Supply chain | SBOM, signed policy, Dependabot | CI audit job |
| MCP-09 | Insufficient logging | `policy_decision` all transports | integration tests |
| MCP-10 | Shadow MCP | Gateway auth required | enterprise preflight |

## OWASP LLM Top 10 (selected)

| ID | Threat | Control |
|----|--------|---------|
| LLM01 | Prompt injection | Semantic gate + encoding guard |
| LLM02 | Insecure output | Response security gate |
| LLM06 | Sensitive disclosure | PCI/HIPAA policy templates |
| LLM08 | Excessive agency | Policy block mode, tool allowlists |

Run corpus: `pnpm eval`. Red team: `pnpm harness:premortem-profiles`.
