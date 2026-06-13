# Enterprise LLM/MCP Attack Corpus

Real attack patterns evaluated against `default-policy.yaml` via `PolicyEngine` — not mocks.

## Structure

```
corpus/
  README.md
  manifest.yaml
  run-eval.ts
  benign/                 # 50+ safe tool calls
  attacks/
    prompt-injection/     # 30+ jailbreak, ignore instructions, DAN, multiline, zero-width
    credential-exfil/     # 25+ paths, env leaks in args
    sql-nosql/            # 25+ union, nosql, graphql
    ssrf-url/             # 25+ metadata, private IP, puppeteer URLs
    shell-obfuscation/    # 25+ encoding, homoglyphs, base64
    cross-tool-chain/     # 15+ read-then-exfil patterns
  edge-cases/             # 20+ unicode, large payloads, boundaries
```

## Entry format

Each JSON file:

```json
{
  "toolName": "search",
  "arguments": { "query": "..." },
  "expected": "block",
  "category": "prompt-injection",
  "ruleHint": "ignore-instructions"
}
```

- `expected`: `"block"` | `"pass"`
- `ruleHint`: optional human-readable tag for reports

## Run locally

```bash
pnpm build
pnpm eval
# or: pnpm exec tsx corpus/run-eval.ts
# CI gate (regex-only semantic path):
MASTYFF_AI_DISABLE_SEMANTIC=true ./scripts/verify-corpus-parity.sh
```

Writes `corpus-eval-report.json` at repo root. Exits non-zero if any attack expected `block` is not blocked, or any benign expected `pass` is blocked.

**Canonical evaluator:** TypeScript `corpus/run-eval.ts` + `PolicyEngine` — not external Python harnesses. Attack count: **154** fixtures (32 prompt-injection, 27 sql-nosql, 26 ssrf-url, 26 shell-obfuscation, 24 credential-exfil, 16 cross-tool-chain, plus edge-case attacks).

## Regenerate corpus

```bash
node scripts/generate-enterprise-corpus.mjs
```

## CI

- PR + push: `ci.yml` job `corpus-eval`
- Nightly: `.github/workflows/corpus-eval.yml`
- Artifact: `corpus-eval-report.json`
