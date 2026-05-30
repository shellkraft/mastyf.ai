# Threat Intelligence Mesh — Privacy Model

This document describes the privacy guarantees of the cross-deployment Threat Intelligence Mesh (Feature #3).

---

## Overview

The Threat Intelligence Mesh enables Guardian deployments to share anonymized threat intelligence without exposing raw tool call data. This is achieved through:

1. **Signature Hashing** — Attack patterns are cryptographically hashed before leaving the deployment
2. **Differential Privacy** — ε-differential privacy suppresses low-frequency observations
3. **Threshold Gating** — Patterns must be reported N times before sharing
4. **Opt-in Architecture** — Mesh participation is disabled by default

---

## Privacy Guarantees

### 1. No Raw Data Leaves the Deployment

When a tool call is blocked by Guardian's policy engine, the system extracts a **hashed signature** of the attack pattern, not the raw data.

```typescript
// What's shared:
signatureHash = hash("ignore all previous instructions")  // "threat-3f2a1b8c..."

// What's NOT shared:
raw tool call arguments
tool names used
file paths accessed
API keys or tokens
session identifiers
```

### 2. ε-Differential Privacy

Before a signature is shared, the system applies differential privacy noise controlled by the `GUARDIAN_THREAT_MESH_EPSILON` parameter.

| Epsilon (ε) | Privacy Level | Signature Sharing Probability | Use Case |
|-------------|--------------|-------------------------------|----------|
| 0.1 | Very High | ~9% | Healthcare, finance, gov |
| 0.5 | High | ~33% | Enterprise with compliance |
| 1.0 (default) | Standard | ~50% | General enterprise |
| 2.0 | Relaxed | ~67% | Security research labs |
| 5.0 | Minimum | ~83% | Public threat intel sharing |

Lower epsilon = stronger privacy but less sharing. Higher epsilon = more sharing but weaker privacy guarantees.

### 3. Minimum Report Threshold

A signature must be observed locally at least `GUARDIAN_THREAT_MESH_MIN_REPORTS` times before it's eligible for sharing.

```
Default: 3 reports
Reason: Prevents sharing of one-off/accidental patterns
         that could contain sensitive context
```

### 4. No Personal Identifiers

Shared signatures contain:
- `signatureHash`: A hash of the normalized attack pattern
- `category`: Attack category (e.g., "shell_injection", "prompt_injection")
- `severity`: Severity level
- `firstSeen`: Timestamp of first observation
- `reportCount`: How many deployments reported this
- `verified`: Whether multiple nodes confirmed this

Signatures **do not** contain:
- Originating deployment identifier
- Originating IP address
- Affected server names
- User/agent identities
- Raw payload data

---

## Configuration

```bash
# Enable mesh participation
GUARDIAN_THREAT_MESH_ENABLED=true

# Privacy strength (lower = more private)
GUARDIAN_THREAT_MESH_EPSILON=1.0

# Minimum local reports before sharing
GUARDIAN_THREAT_MESH_MIN_REPORTS=3

# Relay URL for centralized sharing (optional)
GUARDIAN_THREAT_MESH_RELAY_URL=https://mesh.mcp-guardian.cloud
```

---

## Threat Model

### What the Mesh Protects Against

| Threat | Protection |
|--------|-----------|
| **Pattern reconstruction** — Reconstructing raw data from hashes | One-way cryptographic hashing makes reconstruction computationally infeasible |
| **Membership inference** — Determining if a deployment contributed a signature | Differential privacy noise and threshold gating obscure individual contributions |
| **Frequency analysis** — Inferring deployment activity from report frequency | Report counts are aggregated across all deployments, not per-deployment |
| **Timing attacks** — Correlating signature sharing with tool call timing | Timestamps are randomized within a window; threshold gating adds delay |

### What the Mesh Does NOT Protect Against

| Threat | Reason |
|--------|--------|
| **Identical pattern analysis** — If two deployments share exactly the same attack, the hash will match | This is by design — shared threat intelligence requires hash matching |
| **Deterministic hashing** — Known attack patterns (e.g., "rm -rf /") will produce predictable hashes | Use `GUARDIAN_THREAT_MESH_EPSILON` to add noise to known-pattern sharing |

---

## Compliance

The Threat Mesh is designed to be compatible with:

- **GDPR** — No personal data is shared; only anonymized attack pattern hashes
- **SOC 2** — Full audit trail of all shared signatures via `agentic_decisions` table
- **HIPAA** — No PHI in shared data; mesh can be disabled entirely
- **PCI-DSS** — No cardholder data shared; mesh operates at infrastructure security level

---

## Opt-Out

Threat mesh participation is **disabled by default**. To opt out:

1. Do not set `GUARDIAN_THREAT_MESH_ENABLED=true`
2. If previously enabled, set to `false` and restart

Guardian functions identically without mesh participation — all 9 other features work without it.

---

## Audit

All mesh contributions are logged in the `agentic_decisions` table:

```sql
SELECT * FROM agentic_decisions WHERE feature = 'threat-mesh';
```

Each record includes:
- The decision ID and signature hash
- Whether the signature was shared or suppressed
- The privacy epsilon used
- The report count at time of sharing