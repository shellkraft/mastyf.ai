# Enterprise Evidence Pack

How to generate and validate compliance evidence for security reviews.

## Quick check (CI)

```bash
pnpm enterprise:evidence-check
```

Validates required docs and phrases in `docs/COMPLIANCE.md` and `docs/ENTERPRISE_DEPLOYMENT.md`.

## Full evidence pack

```bash
pnpm run build
pnpm eval                    # corpus eval report
pnpm enterprise:compliance-evidence
pnpm enterprise:evidence-pack
```

Outputs under `reports/compliance/` including signed evidence JSON.

## Artifacts included

- Corpus precision/recall (CC6.8)
- Adversarial harness summary (CC7.2)
- SIEM / audit configuration snapshot
- Policy change log excerpts
- EU AI Act transparency section (when semantic LLM enabled)

## Customer consumption

Attach `reports/compliance/evidence-pack-*.json` and `sbom.cdx.json` from GitHub Releases to vendor security questionnaires.

See [docs/supply-chain.md](./supply-chain.md) for SBOM verification.
