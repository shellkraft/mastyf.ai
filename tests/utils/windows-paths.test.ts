import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import {
  quotePathForPowerShell,
  resolveMastyffAiProxyWrapper,
  buildWrappedMcpServerEntry,
} from '../../src/utils/windows-paths.js';

describe('windows-paths', () => {
  const projectRoot = path.join('C:', 'Users', 'John Doe', 'mastyff-ai');
  const configPath = path.join(projectRoot, 'mastyff-ai-configs', 'github.json');
  const policyPath = path.join(projectRoot, 'policy-audit.yaml');

  describe('quotePathForPowerShell', () => {
    it('wraps paths with spaces in double quotes', () => {
      expect(quotePathForPowerShell('C:\\Users\\John Doe\\.cursor')).toBe(
        '"C:\\Users\\John Doe\\.cursor"',
      );
    });

    it('escapes embedded double quotes and backticks', () => {
      expect(quotePathForPowerShell('C:\\temp\\`weird`"name')).toBe(
        '"C:\\temp\\``weird```"name"',
      );
    });
  });

  describe('resolveMastyffAiProxyWrapper', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns mastyff-ai-proxy.ps1 on win32', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(resolveMastyffAiProxyWrapper(projectRoot)).toBe(
        path.join(projectRoot, 'mastyff-ai-proxy.ps1'),
      );
    });

    it('returns scripts/mastyff-ai-proxy.sh on non-win32', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      expect(resolveMastyffAiProxyWrapper(projectRoot)).toBe(
        path.join(projectRoot, 'scripts', 'mastyff-ai-proxy.sh'),
      );
    });
  });

  describe('buildWrappedMcpServerEntry', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('uses powershell -File with spaced paths on win32', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const entry = buildWrappedMcpServerEntry(projectRoot, configPath, policyPath);
      expect(entry.command).toMatch(/powershell/i);
      expect(entry.args[0]).toBe('-NoProfile');
      expect(entry.args).toContain('-File');
      expect(entry.args).toContain(path.join(projectRoot, 'mastyff-ai-proxy.ps1'));
      expect(entry.args).toContain(configPath);
      expect(entry.args).toContain(policyPath);
    });

    it('uses shell wrapper directly on unix', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      const entry = buildWrappedMcpServerEntry(projectRoot, configPath, policyPath);
      expect(entry.command).toBe(path.join(projectRoot, 'scripts', 'mastyff-ai-proxy.sh'));
      expect(entry.args).toEqual(['--config', configPath, '--policy', policyPath]);
    });
  });

  describe('mastyff-ai-proxy.ps1 on disk', () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

    it('exists at repo root with try/catch and arg forwarding', () => {
      const rootScript = path.join(repoRoot, 'mastyff-ai-proxy.ps1');
      const scriptsScript = path.join(repoRoot, 'scripts', 'mastyff-ai-proxy.ps1');
      expect(fs.existsSync(rootScript)).toBe(true);
      expect(fs.existsSync(scriptsScript)).toBe(true);

      for (const scriptPath of [rootScript, scriptsScript]) {
        const content = fs.readFileSync(scriptPath, 'utf-8');
        expect(content).toMatch(/ValueFromRemainingArguments/);
        expect(content).toMatch(/& \$nodeExe @argList/);
        expect(content).toMatch(/try \{/);
        expect(content).toMatch(/MASTYFF_AI_DB_PATH/);
        expect(content).toMatch(/DASHBOARD_ENABLED/);
      }
    });
  });
});
