import { describe, it, expect } from 'vitest';
import { wrapPlainText } from '../../src/tui/text-wrap.js';

describe('wrapPlainText', () => {
  it('preserves paragraph breaks', () => {
    const lines = wrapPlainText('line one\n\nline two', 80);
    expect(lines).toContain('line one');
    expect(lines).toContain('');
    expect(lines).toContain('line two');
  });

  it('wraps long lines', () => {
    const text = 'word '.repeat(30).trim();
    const lines = wrapPlainText(text, 20);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(20);
  });
});
