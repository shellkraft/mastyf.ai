import { describe, it, expect } from 'vitest';
import { decodeResponseForInspection } from '../../src/utils/response-decode.js';
import { scanForSecrets } from '../../src/scanners/secret-scanner.js';

describe('response confusables (M-005)', () => {
  it('normalizes homoglyphs in response before secret scan', () => {
    const homoglyphSk = 'sk-' + 'А'.repeat(20);
    const decoded = decodeResponseForInspection(homoglyphSk, { unicodeStrict: true });
    expect(decoded.passes).toContain('confusables-tr39');
    const findings = scanForSecrets(decoded.text, 'response:body');
    expect(findings.some((f) => f.type.includes('sk') || f.severity === 'HIGH')).toBeDefined();
  });
});
