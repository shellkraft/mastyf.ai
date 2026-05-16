import { describe, it, expect } from 'vitest';
import { OsvClient } from '../../src/clients/osv-client.js';

describe('OsvClient.mapSeverity', () => {
  const client = new OsvClient();

  it('maps string severity', () => {
    expect((client as any).mapSeverity('high')).toBe('HIGH');
  });

  it('maps OSV array severity objects', () => {
    expect((client as any).mapSeverity([{ type: 'CVSS_V3', score: '9.8' }])).toBe('CRITICAL');
    expect((client as any).mapSeverity([{ type: 'CVSS_V3', score: '7.5' }])).toBe('HIGH');
  });

  it('maps OSV object severity', () => {
    expect((client as any).mapSeverity({ type: 'CVSS_V3', score: '5.0' })).toBe('MEDIUM');
  });

  it('defaults unknown shapes to MEDIUM', () => {
    expect((client as any).mapSeverity(null)).toBe('MEDIUM');
    expect((client as any).mapSeverity(undefined)).toBe('MEDIUM');
  });
});
