# Required CI Status Checks

Configure branch protection on `main` to require:

| Check | Workflow | Job |
|-------|----------|-----|
| Test & Typecheck | `ci.yml` | `test` |
| Enterprise Preflight | `ci.yml` | `enterprise` |
| Dependency Audit | `ci.yml` | `audit` |
| OSV Scan | `ci.yml` | `audit` |
| Gitleaks | `gitleaks.yml` | `scan` |
| Trivy (PR) | `ci.yml` | `docker-scan` |
| Helm Lint | `ci.yml` | `helm-lint` |
| Enterprise evidence | `ci.yml` | `evidence-check` |
| Policy schema | `ci.yml` | `policy-schema` |
| Smoke Test | `smoke-test.yml` | `smoke` |
| Cloud staging (PR) | `cloud-deploy-staging.yml` | `preview` |

Production cloud deploy requires GitHub Environment `production` approval on `cloud-deploy.yml`.

Publish to npm requires green tests before any `npm publish` step in `publish.yml`.
