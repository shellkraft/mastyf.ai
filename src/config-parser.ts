import fs from 'fs';
import path from 'path';
import os from 'os';
import yaml from 'js-yaml';
import { McpServerConfig } from './types.js';

/**
 * Parses MCP configuration files from various clients.
 * Supports aggregation across multiple config files with deduplication.
 */
export class ConfigParser {
  /**
   * Find all known MCP config files on the system.
   */
  static findConfigPaths(): string[] {
    const home = os.homedir();
    const candidates = [
      // Cline — VS Code
      path.join(home, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
      path.join(home, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
      path.join(home, 'AppData', 'Roaming', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
      // Cline — VS Code Insiders
      path.join(home, 'Library', 'Application Support', 'Code - Insiders', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json'),
      // Claude Desktop
      path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
      path.join(home, '.config', 'Claude', 'claude_desktop_config.json'),
      // Cursor
      path.join(home, '.cursor', 'mcp.json'),
      // Windsurf
      path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
    ];

    return candidates.filter((p) => {
      try {
        return fs.existsSync(p);
      } catch {
        return false;
      }
    });
  }

  /**
   * Parse a single MCP config file into an array of server configs.
   */
  static parse(filePath: string): McpServerConfig[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    let raw: Record<string, unknown>;

    if (ext === '.yaml' || ext === '.yml') {
      raw = (yaml.load(content) ?? {}) as Record<string, unknown>;
    } else {
      raw = JSON.parse(content);
    }

    // Normalize different schemas
    let servers: Record<string, unknown>;
    if (raw.mcpServers && typeof raw.mcpServers === 'object') {
      servers = raw.mcpServers as Record<string, unknown>;
    } else if (raw.servers && typeof raw.servers === 'object') {
      servers = raw.servers as Record<string, unknown>;
    } else {
      // Assume the file itself is a flat map of server name → config
      servers = raw as Record<string, unknown>;
    }

    return Object.entries(servers).map(([name, config]) => {
      const cfg = config as Record<string, unknown>;
      return {
        name,
        command: typeof cfg.command === 'string' ? cfg.command : undefined,
        args: Array.isArray(cfg.args) ? cfg.args as string[] : undefined,
        env: cfg.env && typeof cfg.env === 'object' ? cfg.env as Record<string, string> : undefined,
        url: typeof cfg.url === 'string' ? cfg.url : undefined,
        transport: (cfg.transport === 'sse' ? 'sse' : 'stdio') as 'stdio' | 'sse',
        packageName: typeof cfg.packageName === 'string' ? cfg.packageName : undefined,
        version: typeof cfg.version === 'string' ? cfg.version : undefined,
      };
    });
  }

  /**
   * Parse all discoverable configs, merge with deduplication, and return unified list.
   * First config file takes priority for servers with the same name.
   */
  static parseAll(): { servers: McpServerConfig[]; sourcePaths: string[] } {
    const paths = ConfigParser.findConfigPaths();
    if (paths.length === 0) return { servers: [], sourcePaths: [] };

    const seen = new Set<string>();
    const allServers: McpServerConfig[] = [];

    for (const p of paths) {
      try {
        const parsed = ConfigParser.parse(p);
        for (const server of parsed) {
          if (!seen.has(server.name)) {
            seen.add(server.name);
            allServers.push(server);
          }
        }
      } catch {
        // Skip unparseable files
      }
    }

    return { servers: allServers, sourcePaths: paths };
  }
}