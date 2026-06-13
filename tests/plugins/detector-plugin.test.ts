import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  registerDetectorPlugin,
  clearDetectorPluginsForTests,
  runDetectorPlugins,
} from '../../src/plugins/detector-plugin.js';
import { scanForSecrets } from '../../src/scanners/secret-scanner.js';

describe('DetectorPlugin registry', () => {
  const prevEnabled = process.env['MASTYFF_AI_PLUGINS_ENABLED'];

  beforeEach(() => {
    clearDetectorPluginsForTests();
  });

  afterEach(() => {
    clearDetectorPluginsForTests();
    if (prevEnabled === undefined) delete process.env['MASTYFF_AI_PLUGINS_ENABLED'];
    else process.env['MASTYFF_AI_PLUGINS_ENABLED'] = prevEnabled;
  });

  it('does not run plugins when MASTYFF_AI_PLUGINS_ENABLED is false', () => {
    process.env['MASTYFF_AI_PLUGINS_ENABLED'] = 'false';
    registerDetectorPlugin({
      name: 'test-plugin',
      scanArguments: () => [{ type: 'x', location: 'l', severity: 'HIGH' }],
    });
    expect(runDetectorPlugins('CUSTOM_SECRET_ABCD1234', {})).toHaveLength(0);
  });

  it('runs registered plugin after built-in scan when enabled', () => {
    process.env['MASTYFF_AI_PLUGINS_ENABLED'] = 'true';
    registerDetectorPlugin({
      name: 'custom-pattern',
      scanArguments(text) {
        if (/MYTOKEN_[A-Z]{4}/.test(text)) {
          return [{ type: 'mytoken', location: 'args', severity: 'HIGH', redacted: 'MYTOKEN_[REDACTED]' }];
        }
        return [];
      },
    });

    const findings = scanForSecrets('prefix MYTOKEN_ABCD suffix', 'test-ctx');
    expect(findings.some((f) => f.type === 'mytoken')).toBe(true);
  });
});
