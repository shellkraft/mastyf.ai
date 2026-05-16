/**
 * P0 Week 3: DLP on tool call arguments tests
 * Validates that the secret scanner detects API keys, tokens, and credentials
 * in tool call arguments as they would appear in live MCP traffic.
 */
import { describe, it, expect } from 'vitest';
import { scanForSecrets } from '../src/scanners/secret-scanner.js';

describe('P0 Week 3: DLP on tool call arguments', () => {
  it('should detect GitHub PAT in tool arguments', () => {
    const args = JSON.stringify({ token: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890' });
    const findings = scanForSecrets(args, 'proxy:test-server:write_file');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.type).toBe('github-pat-classic');
  });

  it('should detect OpenAI API key in nested arguments', () => {
    const args = JSON.stringify({ config: { api_key: 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234' } });
    const findings = scanForSecrets(args, 'proxy:test-server:configure');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some(f => f.type === 'openai-api-key-v2')).toBe(true);
  });

  it('should detect Anthropic API key', () => {
    const args = JSON.stringify({
      api_key: 'sk-ant-abc123def456ghi789jkl012mno345pqr678stu901vwx234yzA67890abcdefghijklmnopqrstuvwxyz1234567890abcdefghij'
    });
    const findings = scanForSecrets(args, 'proxy:test-server:claude_call');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some(f => f.type === 'anthropic-api-key')).toBe(true);
  });

  it('should detect AWS access key (canonical DLP sample) in raw strings', () => {
    const rawArgs = 'AKIAIOSFODNN7EXAMPLE';
    const findings = scanForSecrets(rawArgs, 'proxy:test-server:aws_op');
    expect(findings.some((f) => f.type === 'aws-access-key')).toBe(true);
  });

  it('should detect AWS access key in JSON-stringified tool arguments', () => {
    const args = JSON.stringify({
      content: 'export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE',
    });
    const findings = scanForSecrets(args, 'proxy:test-server:write_file');
    expect(findings.some((f) => f.type === 'aws-access-key')).toBe(true);
  });

  it('should detect database connection string with credentials', () => {
    const args = JSON.stringify({ db_url: 'postgresql://admin:secretpass123@db.example.com:5432/mydb' });
    const findings = scanForSecrets(args, 'proxy:test-server:db_query');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some(f => f.type === 'postgres-url')).toBe(true);
  });

  it('should detect Slack webhook URL', () => {
    const args = JSON.stringify({
      webhook: 'https://hooks.slack.com/services/T0123456789/B0123456789/abcdefghijklmnopqrstuvwxyz'
    });
    const findings = scanForSecrets(args, 'proxy:test-server:notify');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some(f => f.type === 'slack-webhook')).toBe(true);
  });

  it('should detect MongoDB connection string with credentials', () => {
    const args = JSON.stringify({ uri: 'mongodb+srv://admin:secretpass123@cluster0.example.mongodb.net/mydb' });
    const findings = scanForSecrets(args, 'proxy:test-server:db_connect');
    expect(findings.some(f => f.type === 'mongodb-url')).toBe(true);
  });

  it('should detect JWT secret in env-var style arguments', () => {
    // jwt_secret regex: /jwt[_-]?secret\s*[=:]\s*['"]?[a-zA-Z0-9\-_]{20,}['"]?/i
    // Pattern matches `jwt_secret=VALUE` or `jwt-secret:VALUE` style assignments
    const rawArgs = 'jwt_secret=aB3dEfGhIjKlMnOpQrStUvWxYz';
    const findings = scanForSecrets(rawArgs, 'proxy:test-server:auth');
    expect(findings.some(f => f.type === 'jwt-secret')).toBe(true);
  });

  it('should detect generic password in env-style arguments', () => {
    // generic-password regex: /password\s*[:=]\s*['"]([^'"]{8,})['"]/i
    // Pattern matches `password="value"` or `password: "value"` style
    const rawArgs = 'password="superS3cretPassphrase"';
    const findings = scanForSecrets(rawArgs, 'proxy:test-server:login');
    expect(findings.some(f => f.type === 'generic-password')).toBe(true);
  });

  it('should NOT flag benign arguments with no secrets', () => {
    const args = JSON.stringify({ query: 'SELECT * FROM users', limit: 10, page: 1 });
    const findings = scanForSecrets(args, 'proxy:test-server:search');
    expect(findings.length).toBe(0);
  });

  it('should NOT flag placeholder/example values', () => {
    const args = JSON.stringify({ api_key: 'your-api-key-here', token: 'xxxxxxxxxxxx' });
    const findings = scanForSecrets(args, 'proxy:test-server:example');
    // Generic api-key pattern may or may not flag placeholders depending on entropy
    // The key test: it should not flag obviously fake values as HIGH severity
    const highFindings = findings.filter(f => f.severity === 'HIGH');
    expect(highFindings.length).toBe(0);
  });

  it('should detect secrets in deeply nested JSON arguments', () => {
    const args = JSON.stringify({
      level1: {
        level2: {
          level3: {
            token: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890'
          }
        }
      }
    });
    const findings = scanForSecrets(args, 'proxy:test-server:deep');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.type).toBe('github-pat-classic');
  });

  it('should detect multiple secrets in the same argument', () => {
    const args = JSON.stringify({
      github_token: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890',
      openai_key: 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234',
      db_url: 'postgresql://user:pass@host/db',
    });
    const findings = scanForSecrets(args, 'proxy:test-server:multi');
    expect(findings.length).toBeGreaterThanOrEqual(3);
  });

  it('should handle empty arguments gracefully', () => {
    const findings = scanForSecrets('{}', 'proxy:test-server:empty');
    expect(findings.length).toBe(0);
  });

  it('should detect private key in arguments', () => {
    const args = JSON.stringify({ key: '-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBA...\n-----END RSA PRIVATE KEY-----' });
    const findings = scanForSecrets(args, 'proxy:test-server:ssh');
    expect(findings.some(f => f.type === 'generic-private-key')).toBe(true);
  });
});