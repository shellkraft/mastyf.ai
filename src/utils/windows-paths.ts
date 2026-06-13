import path from 'path';

/** Escape a path for a PowerShell double-quoted string literal. */
export function quotePathForPowerShell(filePath: string): string {
  const escaped = filePath.replace(/`/g, '``').replace(/"/g, '`"');
  return `"${escaped}"`;
}

/** Mastyff AI proxy wrapper script for the current platform. */
export function resolveMastyffAiProxyWrapper(projectRoot: string): string {
  if (process.platform === 'win32') {
    return path.join(projectRoot, 'mastyff-ai-proxy.ps1');
  }
  return path.join(projectRoot, 'scripts', 'mastyff-ai-proxy.sh');
}

export interface WrappedMcpServerEntry {
  command: string;
  args: string[];
  transport: 'stdio';
  env?: Record<string, string>;
}

/** MCP client JSON entry for a wrapped upstream server (handles paths with spaces). */
export function buildWrappedMcpServerEntry(
  projectRoot: string,
  singleConfigPath: string,
  policyPath: string,
  extraEnv?: Record<string, string>,
): WrappedMcpServerEntry {
  const wrapperScript = resolveMastyffAiProxyWrapper(projectRoot);
  const proxyArgs = ['--config', singleConfigPath, '--policy', policyPath];
  const env = extraEnv && Object.keys(extraEnv).length > 0 ? { env: extraEnv } : {};

  if (process.platform === 'win32') {
    return {
      command: 'powershell.exe',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', wrapperScript, ...proxyArgs],
      transport: 'stdio',
      ...env,
    };
  }

  return {
    command: wrapperScript,
    args: proxyArgs,
    transport: 'stdio',
    ...env,
  };
}

/** Whether a server config already points at Mastyff AI proxy. */
export function isMastyffAiProxyCommand(command: string): boolean {
  return (
    command.includes('mastyff-ai-proxy') ||
    command.includes('mastyff-ai') ||
    /mastyff-ai-proxy\.ps1$/i.test(command)
  );
}
