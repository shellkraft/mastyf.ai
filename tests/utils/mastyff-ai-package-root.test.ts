import { describe, it, expect, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveMastyffAiInstallRoot,
  resetMastyffAiInstallRootCache,
} from '../../src/utils/mastyff-ai-package-root.js';

describe('resolveMastyffAiInstallRoot', () => {
  afterEach(() => {
    resetMastyffAiInstallRootCache();
  });

  it('resolves repo root with dist/cli.js when running from vitest', () => {
    const root = resolveMastyffAiInstallRoot();
    expect(existsSync(join(root, 'package.json'))).toBe(true);
    expect(existsSync(join(root, 'dist', 'cli.js'))).toBe(true);
  });
});
