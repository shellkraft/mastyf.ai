# Supply chain artifacts

## SBOM (Software Bill of Materials)

Every CI run on pull requests and main branch generates a CycloneDX SBOM:

- **Workflow:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) (job `test`, step `Generate SBOM`)
- **Extended audit:** [`.github/workflows/supply-chain.yml`](../.github/workflows/supply-chain.yml) (OSV scan + `pnpm audit`)

Download the `sbom` artifact from a GitHub Actions run. File: `sbom.cdx.json` (production dependencies, dev omitted).

**GitHub Releases:** npm publish (`publish.yml`) and Docker publish (`docker-publish.yml`) attach `sbom.cdx.json` as a workflow artifact on every tagged release (`v*`).

## Customer SBOM consumption

1. Download `sbom.cdx.json` from the release or CI artifact
2. Import into Dependency-Track, Snyk, or Grype:
   ```bash
   grype sbom:./sbom.cdx.json
   ```
3. Compare component versions against your vulnerability policy
4. Pin container images to digest-signed tags from `docker-publish.yml` (cosign)

## Local generation

```bash
pnpm dlx @cyclonedx/cyclonedx-npm --output-file sbom.cdx.json --omit dev
# or
pnpm run enterprise:sbom
```

## Policy JSON Schema

Policy YAML is validated with Zod at load time. Export JSON Schema after build:

```bash
pnpm run build
node scripts/export-policy-schema.mjs
```

Output: [`policy-schema.json`](../policy-schema.json) (for IDE `$schema` hints and CI validation).
