import { evaluateOpaPolicy } from '../opa-policy.js';
import type { AsyncPolicyStrategy } from './types.js';

export const opaStrategy: AsyncPolicyStrategy = {
  name: 'opa',
  async evaluateAsync(context, deps) {
    const opaEnabled =
      Boolean(process.env['OPA_URL']) &&
      deps.config.policy.opa !== false &&
      (deps.config.policy.opa === true || process.env['MASTYFF_AI_OPA_ENABLED'] === 'true');
    if (!opaEnabled) return null;
    return evaluateOpaPolicy(context);
  },
};
