# Policy Rollback Runbook

## When to use

Bad policy deploy causing mass blocks or bypass.

## Self-hosted

1. Restore previous signed `policy.yaml` + `.sig.json` from Git tag
2. `kubectl rollout restart deployment/mastyf-ai` or `mastyf-ai policy reload`
3. Verify: `mastyf-ai doctor --validate-policy`
4. Monitor block rate for 15 minutes

## Cloud

1. Revert org policy via dashboard or `PUT /api/v1/policy` with last known good YAML
2. Confirm `X-Policy-Version` incremented
3. Connected proxies pick up via policy subscriber within cache TTL

## Four-eyes

Production changes require operator+ role and signed artifact in enterprise mode.
