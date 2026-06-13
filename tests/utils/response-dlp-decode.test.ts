import { describe, expect, it } from 'vitest';
import { decodeResponseForInspection } from '../../src/utils/response-decode.js';
import { evaluateResponseDlp, getResponseDlpMode } from '../../src/policy/response-dlp.js';

describe('decodeResponseForInspection', () => {
  it('decodes percent-encoded secret fragments', () => {
    const raw = 'token=%22sk-testpercent22';
    const d = decodeResponseForInspection(raw);
    expect(d.text).toContain('"');
  });

  it('decodes HTML-encoded quotes around secrets', () => {
    const raw = 'api_key&amp;quot;:&amp;quot;sk-live-abc123secretkeyhere';
    const d = decodeResponseForInspection(raw);
    expect(d.decoded).toBe(true);
    expect(d.text).toContain('"');
  });
});

describe('evaluateResponseDlp redaction', () => {
  it('redacts labeled password value preserving label', () => {
    const prev = process.env.MASTYFF_AI_RESPONSE_DLP_MODE;
    process.env.MASTYFF_AI_RESPONSE_DLP_MODE = 'redact';
    try {
      const r = evaluateResponseDlp('tool', 'srv', 'Database password: supersecret123');
      expect(getResponseDlpMode()).toBe('redact');
      expect(r.redactedBody).toMatch(/password:\s*\[REDACTED\]/i);
      expect(r.redactedBody).not.toContain('supersecret123');
    } finally {
      if (prev === undefined) delete process.env.MASTYFF_AI_RESPONSE_DLP_MODE;
      else process.env.MASTYFF_AI_RESPONSE_DLP_MODE = prev;
    }
  });

  it('finds secrets after HTML entity decode', () => {
    const body = 'key=&quot;AKIAIOSFODNN7EXAMPLE&quot;';
    const r = evaluateResponseDlp('tool', 'srv', body);
    expect(r.decodePasses).toContain('html-entities');
    expect(r.findings.some((f) => f.category === 'sensitive-content' || f.category === 'secret')).toBe(
      true,
    );
  });
});
