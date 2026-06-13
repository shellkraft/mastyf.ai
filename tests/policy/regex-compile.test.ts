import { describe, it, expect } from 'vitest';
import {
  compilePolicyRegex,
  isRegexPatternSafe,
  safeRegexTest,
  shouldRejectUnsafePolicyRegex,
  shouldUseRegexWorker,
  UnsafePolicyRegexError,
} from '../../src/policy/regex-compile.js';

describe('compilePolicyRegex', () => {
  it('compiles YAML-escaped .env path pattern', () => {
    const re = compilePolicyRegex('/\\\\.env');
    expect(re.test('secrets/.env')).toBe(true);
    expect(re.test('readme.txt')).toBe(false);
  });

  it('flags nested quantifier ReDoS patterns', () => {
    expect(isRegexPatternSafe('(a+)+b').safe).toBe(false);
  });

  it('throws on unsafe pattern when reject mode enabled', () => {
    const prev = process.env.MASTYFF_AI_POLICY_REJECT_UNSAFE_REGEX;
    process.env.MASTYFF_AI_POLICY_REJECT_UNSAFE_REGEX = 'true';
    try {
      expect(() => compilePolicyRegex('(a+)+b')).toThrow(UnsafePolicyRegexError);
    } finally {
      if (prev === undefined) delete process.env.MASTYFF_AI_POLICY_REJECT_UNSAFE_REGEX;
      else process.env.MASTYFF_AI_POLICY_REJECT_UNSAFE_REGEX = prev;
    }
  });

  it('neuters unsafe pattern when reject mode disabled', () => {
    const prevReject = process.env.MASTYFF_AI_POLICY_REJECT_UNSAFE_REGEX;
    const prevNode = process.env.NODE_ENV;
    process.env.MASTYFF_AI_POLICY_REJECT_UNSAFE_REGEX = 'false';
    process.env.NODE_ENV = 'development';
    try {
      expect(shouldRejectUnsafePolicyRegex()).toBe(false);
      const re = compilePolicyRegex('(a+)+b');
      expect(re.test('aaa')).toBe(false);
    } finally {
      if (prevReject === undefined) delete process.env.MASTYFF_AI_POLICY_REJECT_UNSAFE_REGEX;
      else process.env.MASTYFF_AI_POLICY_REJECT_UNSAFE_REGEX = prevReject;
      if (prevNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNode;
    }
  });

  it('uses worker-thread eval when enabled', () => {
    const prev = process.env.MASTYFF_AI_REGEX_USE_WORKER;
    process.env.MASTYFF_AI_REGEX_USE_WORKER = 'true';
    try {
      const re = compilePolicyRegex('secret');
      expect(safeRegexTest(re, 'my secret file', 1000)).toBe(true);
      expect(safeRegexTest(re, 'public readme', 1000)).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.MASTYFF_AI_REGEX_USE_WORKER;
      else process.env.MASTYFF_AI_REGEX_USE_WORKER = prev;
    }
  });

  it('defaults worker eval on in production', () => {
    const prevNode = process.env.NODE_ENV;
    const prevWorker = process.env.MASTYFF_AI_REGEX_USE_WORKER;
    delete process.env.MASTYFF_AI_REGEX_USE_WORKER;
    process.env.NODE_ENV = 'production';
    try {
      expect(shouldUseRegexWorker()).toBe(true);
    } finally {
      if (prevNode === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = prevNode;
      if (prevWorker === undefined) delete process.env.MASTYFF_AI_REGEX_USE_WORKER;
      else process.env.MASTYFF_AI_REGEX_USE_WORKER = prevWorker;
    }
  });
});
