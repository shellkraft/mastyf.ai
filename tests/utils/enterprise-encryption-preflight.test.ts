import { describe, expect, it } from 'vitest';
import { runEnterpriseSecurityPreflight } from '../../src/utils/enterprise-bootstrap.js';

describe('enterprise encryption preflight', () => {
  it('throws when enterprise mode without encryption key', () => {
    const prevEnt = process.env.MASTYF_AI_ENTERPRISE_MODE;
    const prevKey = process.env.MASTYF_AI_DB_ENCRYPTION_KEY;
    const prevStrict = process.env.MASTYF_AI_SEMANTIC_STRICT;
    const prevAlert = process.env.MASTYF_AI_ALERTING_REQUIRED;
    const prevBypass = process.env.MASTYF_AI_CI_BYPASS_LICENSE;
    const prevAllowEnv = process.env.MASTYF_AI_ALLOW_ENV_SECRETS_IN_ENTERPRISE;
    process.env.MASTYF_AI_ENTERPRISE_MODE = 'true';
    process.env.MASTYF_AI_SEMANTIC_STRICT = 'true';
    process.env.MASTYF_AI_ALERTING_REQUIRED = 'false';
    process.env.MASTYF_AI_STRICT_MODE = 'false';
    process.env.MASTYF_AI_ALLOW_ENV_SECRETS_IN_ENTERPRISE = 'true';
    delete process.env.MASTYF_AI_CI_BYPASS_LICENSE;
    delete process.env.MASTYF_AI_DB_ENCRYPTION_KEY;
    expect(() => runEnterpriseSecurityPreflight()).toThrow(/MASTYF_AI_DB_ENCRYPTION_KEY/);
    if (prevEnt === undefined) delete process.env.MASTYF_AI_ENTERPRISE_MODE;
    else process.env.MASTYF_AI_ENTERPRISE_MODE = prevEnt;
    if (prevKey === undefined) delete process.env.MASTYF_AI_DB_ENCRYPTION_KEY;
    else process.env.MASTYF_AI_DB_ENCRYPTION_KEY = prevKey;
    if (prevStrict === undefined) delete process.env.MASTYF_AI_SEMANTIC_STRICT;
    else process.env.MASTYF_AI_SEMANTIC_STRICT = prevStrict;
    if (prevAlert === undefined) delete process.env.MASTYF_AI_ALERTING_REQUIRED;
    else process.env.MASTYF_AI_ALERTING_REQUIRED = prevAlert;
    if (prevBypass === undefined) delete process.env.MASTYF_AI_CI_BYPASS_LICENSE;
    else process.env.MASTYF_AI_CI_BYPASS_LICENSE = prevBypass;
    if (prevAllowEnv === undefined) delete process.env.MASTYF_AI_ALLOW_ENV_SECRETS_IN_ENTERPRISE;
    else process.env.MASTYF_AI_ALLOW_ENV_SECRETS_IN_ENTERPRISE = prevAllowEnv;
  });
});
