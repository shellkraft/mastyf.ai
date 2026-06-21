import { describe, expect, it } from 'vitest';
import {
  computeTrustGrade,
  scoreToLevel,
} from '@/lib/trust-badge-grade';
import {
  buildBadgeEmbedMarkdown,
  packagePathFromSegments,
  renderTrustBadgeSvg,
} from '@/lib/trust-badge-svg';

describe('cloud trust badge helpers', () => {
  it('parses scoped package paths', () => {
    expect(packagePathFromSegments(['@scope', 'name'])).toBe('@scope/name');
    expect(packagePathFromSegments(['@scope', 'name.svg'])).toBe('@scope/name');
    expect(packagePathFromSegments(['@scope', 'name', 'json'])).toBe('@scope/name');
  });

  it('renders badge svg', () => {
    const svg = renderTrustBadgeSvg({ score: 88, grade: 'A' });
    expect(svg).toContain('88');
    expect(svg).toContain('A');
  });

  it('maps score to level', () => {
    expect(scoreToLevel(92)).toBe('platinum');
    expect(computeTrustGrade(92)).toBe('A+');
  });

  it('builds embed markdown', () => {
    const md = buildBadgeEmbedMarkdown({
      cloudBaseUrl: 'https://cloud.test',
      packageName: '@acme/mcp',
      style: 'github',
    });
    expect(md).toContain('https://cloud.test/api/v1/badge/');
    expect(md).toContain('style=github');
  });
});
