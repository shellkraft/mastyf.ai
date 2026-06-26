import { describe, expect, it } from 'vitest';
import { isValidNpmPackageName } from '../lib/npm-package-name';
import { packageNameSchema } from '../lib/api-schemas';

describe('npm-package-name', () => {
  it('accepts scoped and unscoped names', () => {
    expect(isValidNpmPackageName('@playwright/mcp')).toBe(true);
    expect(isValidNpmPackageName('lodash')).toBe(true);
  });

  it('rejects invalid sequences', () => {
    expect(isValidNpmPackageName('@/')).toBe(false);
    expect(isValidNpmPackageName('@scope')).toBe(false);
    expect(isValidNpmPackageName('not a package')).toBe(false);
  });
});

describe('packageNameSchema', () => {
  it('rejects @//foo via npm rules', () => {
    expect(packageNameSchema.safeParse('@//foo').success).toBe(false);
  });

  it('accepts valid scoped package', () => {
    expect(packageNameSchema.safeParse('@scope/pkg').success).toBe(true);
  });
});
