# LLM API key rotation runbook

This runbook covers rotation of **proxy** LLM credentials (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) used for semantic scanning and Threat Lab. The cloud trust-score app does not call LLM providers.

## Storage (production)

Set `MASTYF_AI_SECRET_PROVIDER` to a managed backend:

| Provider | Value | Required env |
|----------|-------|--------------|
| HashiCorp Vault | `hashicorp-vault` | `VAULT_ADDR`, `VAULT_TOKEN` |
| AWS Secrets Manager | `aws-secrets-manager` | `AWS_REGION`, IAM role or keys |
| GCP Secret Manager | `gcp-secret-manager` | `GCP_PROJECT_ID`, ADC / `GOOGLE_APPLICATION_CREDENTIALS` |

Store secrets under the same names the proxy expects: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.

Enterprise mode (`MASTYF_AI_ENTERPRISE_MODE=true`) requires a managed provider unless `MASTYF_AI_ALLOW_ENV_SECRETS_IN_ENTERPRISE=true` (temporary only).

## Rotation procedure

1. **Create new key** in Anthropic Console / OpenAI dashboard.
2. **Add new version** in your secret manager (keep old version active during overlap).
3. **Update secret** so `GetSecretValue` / Vault read returns the new key.
4. **Rolling restart** (if not using auto-refresh):
   ```bash
   kubectl rollout restart deployment/mastyf-ai
   ```
5. **Or enable hot refresh** (no restart):
   ```bash
   export MASTYF_AI_LLM_SECRET_REFRESH_MS=300000  # 5 minutes
   ```
   Keys reload from the secret provider on interval via `bootstrapSecrets()`.
6. **Verify**:
   ```bash
   mastyf-ai doctor --policy default-policy.yaml
   # Trigger a semantic scan or Threat Lab job; confirm no auth errors in logs
   ```
7. **Revoke old key** at the provider after all pods have picked up the new secret.

## Dual-key window

During overlap, only one key is active in secret storage at a time. For zero-downtime:

- Update secret manager to new key
- Wait for refresh interval or complete rolling restart
- Confirm metrics/logs show successful LLM calls
- Revoke previous provider key

## Troubleshooting

| Symptom | Check |
|---------|--------|
| `401` from Anthropic/OpenAI | Secret value in manager; pod IAM / Vault token |
| Semantic scans skipped | `MASTYF_AI_LLM_ENABLED`, key present in env after bootstrap |
| Enterprise startup failure | `MASTYF_AI_SECRET_PROVIDER` not `env` |

## References

- Secret provider: [`src/auth/secret-provider.ts`](../src/auth/secret-provider.ts)
- Bootstrap: [`src/utils/enterprise-bootstrap.ts`](../src/utils/enterprise-bootstrap.ts)
- LLM config: [`src/config/llm-config.ts`](../src/config/llm-config.ts)
