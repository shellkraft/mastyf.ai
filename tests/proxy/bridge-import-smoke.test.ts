import { describe, it, expect, afterEach } from 'vitest';
import {
  createHttpProxyWithOAuth,
  buildAuthConfigFromEnv,
} from '../../src/proxy/create-http-proxy-bridge.js';

describe('createHttpProxyWithOAuth bridge', () => {
  afterEach(() => {
    delete process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM;
  });

  it('buildAuthConfigFromEnv reads issuer, audience, required', () => {
    process.env.MASTYF_AI_AUTH_ISSUER = 'https://issuer.example';
    process.env.MASTYF_AI_AUTH_AUDIENCE = 'my-app';
    process.env.MASTYF_AI_AUTH_REQUIRED = 'true';
    expect(buildAuthConfigFromEnv()).toEqual({
      issuer: 'https://issuer.example',
      audience: 'my-app',
      required: true,
    });
    delete process.env.MASTYF_AI_AUTH_ISSUER;
    delete process.env.MASTYF_AI_AUTH_AUDIENCE;
    delete process.env.MASTYF_AI_AUTH_REQUIRED;
  });

  it('createHttpProxyWithOAuth wires OAuthValidator into createHttpProxy', () => {
    process.env.MASTYF_AI_ALLOW_PLAINTEXT_UPSTREAM = 'true';
    const proxy = createHttpProxyWithOAuth(
      'http://127.0.0.1:9',
      null,
      { addCallRecord: async () => {} },
      { count: () => 0 },
      {
        authConfig: {
          issuer: 'https://issuer.test',
          audience: 'test-aud',
          required: true,
        },
        upstreamAgent: undefined,
      },
    );
    expect(proxy).toBeDefined();
    proxy.close();
  });
});
