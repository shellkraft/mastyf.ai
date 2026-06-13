# Policy templates

Optional YAML fragments to merge with `default-policy.yaml` (or your own base policy).

| Template | Purpose | Enable |
|----------|---------|--------|
| [http-tools-policy.yaml](./http-tools-policy.yaml) | SSRF guards for outbound HTTP MCP tools | `MASTYFF_AI_HTTP_TOOLS_POLICY=true` |
| [enterprise-cost-governance.yaml](./enterprise-cost-governance.yaml) | Per-tool rate limits + token budgets | Merge via second `--policy` flag |
| [hipaa-compliance.yaml](./hipaa-compliance.yaml) | PHI pattern blocks + audit metadata | Regulated workloads |
| [pci-dss-masking.yaml](./pci-dss-masking.yaml) | Cardholder data block/redact rules | Payment-adjacent MCP tools |
| [data-residency.yaml](./data-residency.yaml) | Residency metadata flags + doc hooks | Multi-region governance |
| [gxp-compliance.yaml](./gxp-compliance.yaml) | GxP controlled vocabulary + audit metadata | Pharma / regulated workloads |
| [segments/enterprise-soc.yaml](./segments/enterprise-soc.yaml) | Enterprise SOC defaults | Large security teams |
| [segments/ai-startup.yaml](./segments/ai-startup.yaml) | Fast-moving startup defaults | AI-native startup teams |
| [segments/regulated.yaml](./segments/regulated.yaml) | Strict regulated baseline | Finance/health/public sector |
| [segments/mcp-builder.yaml](./segments/mcp-builder.yaml) | MCP builder baseline | Tool/server developers |

## Enterprise cost governance

`enterprise-cost-governance.yaml` adds:

- **Rate limits** (`maxCallsPerMinute`) — global, per expensive tool, and per-server examples. With `REDIS_URL` / Sentinel / Cluster, limits are enforced across all Mastyff AI replicas.
- **Token budgets** (`maxTokens`) — default 32K cap plus tighter caps for batch/embedding tools.

### Daily USD budget (environment)

Policy YAML cannot express a rolling dollar cap. Set on the proxy:

```bash
export MASTYFF_AI_DAILY_BUDGET_USD=50
```

`CostAuditor.getDailySpendUsd()` and `isDailyBudgetExceeded()` read `call_records` since UTC midnight. Legacy alias: `MASTYFF_AI_COST_BUDGET`.

### Merge example

```bash
mastyff-ai proxy \
  --config mcp.json \
  --policy default-policy.yaml \
  --policy policy-templates/enterprise-cost-governance.yaml \
  --blocking-mode block
```

For Kubernetes, append the template rules to the ConfigMap policy or mount as a second file and pass both paths to the container command.
