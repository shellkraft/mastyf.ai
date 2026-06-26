import { describe, expect, it, afterEach } from 'vitest';
import { assertUpstreamTlsAllowed, requireUpstreamTlsAllowed } from '../../src/utils/upstream-tls.js';

describe('upstream-tls', () => {
  afterEach(() => {
    delete process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM;
    delete process.env.MASTYF_AI_STRICT_MODE;
  });

  it('requireUpstreamTlsAllowed throws on plaintext by default', () => {
    expect(() => requireUpstreamTlsAllowed('http://127.0.0.1:8080')).toThrow(/Plaintext HTTP upstream is disabled/);
    expect(assertUpstreamTlsAllowed('http://127.0.0.1:8080').ok).toBe(false);
  });

  it('requireUpstreamTlsAllowed allows https', () => {
    expect(() => requireUpstreamTlsAllowed('https://example.com/mcp')).not.toThrow();
  });

  it('blocks plaintext even with dev flag in strict mode', () => {
    process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM = 'true';
    process.env.MASTYF_AI_STRICT_MODE = 'true';
    expect(() => requireUpstreamTlsAllowed('http://127.0.0.1:8080')).toThrow();
  });
});
