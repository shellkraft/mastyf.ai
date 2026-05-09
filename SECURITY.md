# Security Policy

## Threat Model (STRIDE per MCP Interaction)

MCP Guardian's security posture is modeled against the STRIDE framework for each MCP interaction vector.

### 1. Spoofing (Identity Forgery)

| Threat | Mitigation |
|---|---|
| Typo-squatted MCP server packages | Typo-squat detector with Levenshtein distance against 24 known official packages |
| Fake MCP server responding to health probes | TLS certificate validation for SSE/HTTP transports |
| Malicious server impersonating a trusted tool | Command validation flags non-standard executables |

### 2. Tampering (Data/Command Injection)

| Threat | Mitigation |
|---|---|
| Shell injection via tool arguments | Active policy engine blocks patterns (rm -rf, shell chaining, backtick substitution) |
| Path traversal | Active policy engine blocks ../ patterns |
| Supply chain compromise of MCP server package | CVE checker queries OSV.dev and NVD for known vulnerabilities |

### 3. Repudiation (Deniability)

| Threat | Mitigation |
|---|---|
| No audit trail for blocked/allowed tool calls | Structured JSON logging (pino) captures every policy_decision |
| Policy changes without audit | PolicyAuditor (v1.0.1) records every policy change with hash verification |
| Denied access attempts not recorded | tool_blocked events logged at WARN level for SIEM alerting |

### 4. Information Disclosure (Secrets/Data Leakage)

| Threat | Mitigation |
|---|---|
| Hardcoded API keys, tokens, passwords in MCP config | Secret scanner (6 regex patterns) |
| Unencrypted transport | Auth prober flags unencrypted transports |
| Sensitive data in generated reports | Reports use config names, not raw secrets |

### 5. Denial of Service (Availability)

| Threat | Mitigation |
|---|---|
| Token bombs | Token budget rule (maxTokens) flags/blocks oversized calls |
| Tool overload (>15 tools) | Health monitor detects overload; --fail-on-overload CLI flag |
| Rate abuse | Rate limiting rule (maxCallsPerMinute) per server+tool |
| API ban on CVE lookup services | Token-bucket rate limiter on OSV.dev (5 req/min) and NVD (20 req/min with key) |

### 6. Elevation of Privilege (Agent Hijacking)

| Threat | Mitigation |
|---|---|
| Confused deputy attack | Tool allowlist/denylist in policy engine; argument pattern blocking |
| Agent tricked into calling dangerous tools | Default policy denies execute_command, bash, sh, eval, exec |
| Missing authentication on MCP servers | OAuth 2.1/OIDC JWT validation with RBAC (scopes, client IDs) |

## Supported Versions

| Version | Status | Security Updates |
|---|---|---|
| 1.0.x | ✅ Current | All updates |
| 0.7.x | ✅ Supported | Critical only |
| <0.7.0 | ❌ Unsupported | None |

## Reporting a Vulnerability

**Do not open a public issue for security vulnerabilities.**

Email **rudraneel93@gmail.com** with:
- Description of the vulnerability
- Steps to reproduce
- Affected version(s)
- Any proof-of-concept or crash data

Response timeline:
- **24 hours:** Acknowledgement
- **72 hours:** Initial assessment
- **7 days:** Patch or mitigation plan

## Incident Response

### Severity Classification

| Level | Example | Response |
|---|---|---|
| **Critical** | RCE via proxy, auth bypass, secret leak | Patch within 24 hours, CVE disclosure |
| **High** | Policy bypass, DoS vulnerability | Patch within 72 hours |
| **Medium** | Information disclosure, limited impact | Patch in next release |
| **Low** | Minor configuration issues | Documented workaround |

### Emergency Patch Process

1. **Isolate:** If a vulnerability is confirmed, immediately document the affected versions and attack vector
2. **Mitigate:** Provide a temporary workaround (policy rule, config change) within 24 hours
3. **Patch:** Release a fix with full test coverage
4. **Disclose:** Publish advisory in GitHub Security Advisories and npm audit

### Dependency Supply Chain

- All dependencies are pinned via `package-lock.json`
- CI pipeline runs `npm audit` on every commit
- Critical dependencies (`@modelcontextprotocol/sdk`, `jose`, `pg`) are reviewed on each major version bump
- OTel gRPC exporter removed (v1.0.1) due to critical CVE in protobufjs dependency chain

## Security Design Principles

1. **Least Privilege:** The policy engine denies by default when configured with allowlists
2. **Defense in Depth:** Static scanning (config audit) + runtime enforcement (proxy policy) + SIEM logging
3. **Fail Secure:** Graceful shutdown flushes DB before exit; blocked calls return explicit errors
4. **Auditability:** Every policy decision, block, and proxy event is logged as structured JSON. Policy changes are recorded via PolicyAuditor
5. **Zero Trust on Input:** All tool arguments are pattern-checked regardless of source

## Dependencies

MCP Guardian requires these critical dependencies:

| Dependency | Purpose | Security Notes |
|---|---|---|
| `@modelcontextprotocol/sdk` | MCP protocol implementation | Keep updated to latest; CVE monitoring |
| `tiktoken` | Token counting (o200k_base encoding) | Pure JS, no native bindings |
| `sql.js` | SQLite storage | WASM-based, no native compilation |
| `pino` | Structured logging | High-performance JSON logger |
| `js-yaml` | YAML policy parsing | Policy files only |
| `jose` | JWT/JWK validation | OAuth 2.1/OIDC support |
| `ioredis` | Redis client | Session cache and rate limit store |
| `pg` | PostgreSQL client | Production DB backend |
| `prom-client` | Prometheus metrics | Monitoring |

Run `npm audit` regularly and update dependencies through Dependabot or similar tools.