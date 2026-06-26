# Security Advisory: Legacy HttpProxyServer TLS and Authentication (M-006)

**Date:** 2026-06-26  
**Severity:** Critical  
**Affected:** mastyf.ai releases prior to the Jun 26 2026 inbound TLS/auth hardening commit

## Summary

The legacy `HttpProxyServer` transport (`src/proxy/http-proxy-server.ts`) did not enforce inbound TLS or JWT/mTLS authentication at startup. Deployments running builds from before this fix could expose an **unauthenticated HTTP MCP proxy endpoint** on the configured listen port.

## Fixed in

- Startup fail-closed when `MASTYF_AI_REQUIRE_INBOUND_TLS=true` without `MASTYF_AI_TLS_CERT_PATH` / `MASTYF_AI_TLS_KEY_PATH`
- Startup fail-closed when `MASTYF_AI_AUTH_REQUIRED=true` without an `OAuthValidator`
- Tests: `tests/proxy/http-proxy-server.test.ts`

## Recommended actions

1. **Upgrade** to a build that includes the Jun 26 2026 hardening (or later).
2. **Enable enterprise overlay** — `deploy/helm/mastyf-ai/values-enterprise.yaml` sets `MASTYF_AI_AUTH_REQUIRED=true` and ingress TLS.
3. **Rotate credentials** if the HTTP proxy was exposed on a public interface before upgrade.
4. **Review access logs** for the exposure window for unauthorized `tools/call` activity.

## Configuration reference

| Variable | Purpose |
|----------|---------|
| `MASTYF_AI_REQUIRE_INBOUND_TLS` | Reject startup without TLS cert/key |
| `MASTYF_AI_TLS_CERT_PATH` / `MASTYF_AI_TLS_KEY_PATH` | Inbound TLS material |
| `MASTYF_AI_AUTH_REQUIRED` | Require OAuth validator on every request |

See [ENTERPRISE_DEPLOYMENT.md](./ENTERPRISE_DEPLOYMENT.md) for full production checklist.
