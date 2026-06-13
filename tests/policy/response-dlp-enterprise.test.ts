import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  evaluateResponseDlp,
  getResponseDlpMode,
  shouldBlockResponseDlp,
} from '../../src/policy/response-dlp.js';

describe('response DLP enterprise', () => {
  const prev = process.env.MASTYFF_AI_RESPONSE_DLP_MODE;

  afterEach(() => {
    if (prev) process.env.MASTYFF_AI_RESPONSE_DLP_MODE = prev;
    else delete process.env.MASTYFF_AI_RESPONSE_DLP_MODE;
  });

  it('detects expanded PII patterns', () => {
    const r = evaluateResponseDlp('t', 's', 'contact +1-555-123-4567 and IBAN DE89370400440532013000');
    expect(r.findings.some((f) => f.ruleId === 'pii-phone' || f.ruleId === 'pii-iban')).toBe(true);
  });

  it('redact mode scrubs sensitive spans', () => {
    process.env.MASTYFF_AI_RESPONSE_DLP_MODE = 'redact';
    const body = 'user ssn 123-45-6789 ok';
    const r = evaluateResponseDlp('t', 's', body);
    expect(r.mode).toBe('redact');
    expect(r.redactedBody).toBeDefined();
    expect(r.redactedBody).not.toContain('123-45-6789');
    expect(shouldBlockResponseDlp(r)).toBe(false);
  });

  it('redact mode preserves line structure for labeled secrets', () => {
    process.env.MASTYFF_AI_RESPONSE_DLP_MODE = 'redact';
    const r = evaluateResponseDlp('t', 's', 'Database password: supersecret123');
    expect(r.redactedBody).toContain('Database password: [REDACTED]');
    expect(r.redactedBody).not.toContain('supersecret123');
  });

  it('audit mode never blocks', () => {
    process.env.MASTYFF_AI_RESPONSE_DLP_MODE = 'audit';
    const r = evaluateResponseDlp('t', 's', 'AKIAIOSFODNN7EXAMPLE');
    expect(getResponseDlpMode()).toBe('audit');
    expect(shouldBlockResponseDlp(r)).toBe(false);
  });

  it('detects HIPAA PHI markers (ICD-10, NDC, diagnosis)', () => {
    const r = evaluateResponseDlp(
      't',
      's',
      'Patient chart: ICD-10 E11.9, NDC 12345-678-90, diagnosis: Type 2 diabetes mellitus',
    );
    const ids = r.findings.map((f) => f.ruleId);
    expect(ids.some((id) => id.startsWith('pii-icd10') || id === 'content-phi-marker')).toBe(true);
    expect(ids.some((id) => id.startsWith('pii-ndc') || id === 'content-phi-marker')).toBe(true);
    expect(ids.some((id) => id === 'pii-diagnosis' || id === 'content-phi-marker')).toBe(true);
  });
});
