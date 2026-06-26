# EU AI Act Compliance

## System classification

MCP Mastyf AI is **limited risk** under the EU AI Act: AI-assisted security scanning and semantic policy evaluation with transparency obligations (Art. 50).

Not high-risk: no biometric identification, critical infrastructure control, or autonomous physical actuation.

## Article mapping

| Article | Obligation | MCP Mastyf AI control |
|---------|------------|------------------------|
| Art. 9 | Risk management | Corpus eval, adversarial harness, Threat Lab |
| Art. 10 | Data governance | Policy-scoped tool args; no training on customer payloads by default |
| Art. 11 | Technical documentation | [COMPLIANCE.md](../COMPLIANCE.md), evidence pack |
| Art. 12 | Record-keeping | Audit hash chain, SIEM export |
| Art. 13 | Transparency | AI notice when semantic LLM used (see below) |
| Art. 14 | Human oversight | Threat Lab approval, four-eyes policy, autopilot shadow mode |
| Art. 15 | Accuracy | Corpus recall gates in CI; regression alerts |

## Gaps and mitigations

| Gap | Mitigation |
|-----|------------|
| Model cards | Document Ollama/OpenAI models in deploy runbook |
| Deployer instructions | [ENTERPRISE_DEPLOYMENT.md](../ENTERPRISE_DEPLOYMENT.md) production checklist |

## AI transparency notice

When `MASTYF_AI_LOCAL_SEMANTIC` or cloud deep-scan uses LLM:

> This response includes AI-assisted security analysis. Human operators may review blocks in the dashboard Threat Lab before policy enforcement changes.

Inject via `X-Mastyf-Ai-Ai-Notice: limited-risk-transparency` on flagged/blocked semantic decisions.

## Human oversight flows

- **Threat Lab:** operator accepts/rejects learned rules before enforce
- **Policy four-eyes:** signed policy + operator RBAC for PUT
- **Autopilot:** shadow → enforce stages with dashboard approval

Evidence: `pnpm enterprise:compliance-evidence` includes `euAiAct` section.
