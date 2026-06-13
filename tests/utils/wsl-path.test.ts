import { describe, it, expect } from 'vitest';
import { wslMountToWindows, wslUncToLinux, translateWslPath } from '../../src/utils/wsl-path.js';
import { evaluatePathGuard } from '../../src/policy/path-guard.js';

describe('wsl-path', () => {
  it('maps /mnt/c/Users/foo to C:/Users/foo', () => {
    expect(wslMountToWindows('/mnt/c/Users/Developer/project')).toBe('C:/Users/Developer/project');
  });

  it('maps \\\\wsl$\\Ubuntu\\home\\user to /home/user', () => {
    expect(wslUncToLinux('\\\\wsl$\\Ubuntu\\home\\user\\file.txt')).toBe('/home/user/file.txt');
  });

  it('translateWslPath normalizes mount paths', () => {
    expect(translateWslPath('/mnt/d/data/config.json')).toBe('D:/data/config.json');
  });

  it('path-guard blocks sensitive paths after WSL normalization', () => {
    const prev = process.env.MASTYFF_AI_WSL_PATH_MAP;
    process.env.MASTYFF_AI_WSL_PATH_MAP = 'true';
    const result = evaluatePathGuard(['/mnt/c/Users/x/.ssh/id_rsa']);
    if (prev === undefined) delete process.env.MASTYFF_AI_WSL_PATH_MAP;
    else process.env.MASTYFF_AI_WSL_PATH_MAP = prev;
    expect(result.block).toBe(true);
  });
});
