import { describe, it, expect } from 'vitest';
import { scanArgumentEntropy } from '../../src/utils/arg-entropy.js';

describe('scanArgumentEntropy', () => {
  it('flags long base64 blobs', () => {
    const blob = 'eyJkYXRhYmFzZV91cmwiOiJwb3N0Z3JlczovL3VzZXI6cGFzc0Bob3N0L2RiIn0='.repeat(3);
    const findings = scanArgumentEntropy(JSON.stringify({ body: blob }));
    expect(findings.some((f) => f.kind === 'base64-blob')).toBe(true);
  });

  it('ignores short low-entropy strings', () => {
    const findings = scanArgumentEntropy(JSON.stringify({ query: 'hello world' }));
    expect(findings).toHaveLength(0);
  });
});
