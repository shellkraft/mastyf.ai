import { scanForSecrets } from '../../scanners/secret-scanner.js';
import type { PolicyStrategy } from './types.js';

/** Block HIGH-severity secrets in tool arguments (parity with proxy DLP path). */
export const secretsInArgsStrategy: PolicyStrategy = {
  name: 'secrets-in-args',
  evaluate({ normalized, argsStr }, deps) {
    const blob = argsStr.length > 0 ? argsStr : JSON.stringify(normalized.arguments ?? {});
    if (!blob || blob.length < 8) return null;

    const findings = scanForSecrets(
      blob,
      `policy:${normalized.serverName}:${normalized.toolName}`,
    );
    const blocking = findings.filter((f) => f.severity === 'HIGH');
    if (blocking.length === 0) return null;

    const summary = blocking
      .slice(0, 5)
      .map((f) => f.type)
      .join(', ');

    return {
      action: deps.resolveAction('block'),
      rule: 'secret-scan',
      reason: `${blocking.length} secret(s) in tool arguments: ${summary}`,
    };
  },
};
