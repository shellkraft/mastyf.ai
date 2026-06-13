import { describe, it, expect, afterEach } from 'vitest';
import {
  parseRemotePathMap,
  translatePath,
  isRemoteSshEnabled,
} from '../../src/utils/remote-path.js';

describe('remote-path', () => {
  afterEach(() => {
    delete process.env.MASTYFF_AI_REMOTE_SSH;
    delete process.env.MASTYFF_AI_REMOTE_PATH_MAP;
  });

  it('parses JSON path map', () => {
    const map = parseRemotePathMap('{"C:/Users/dev/app":"/home/vscode/app"}');
    expect(map).toEqual([{ local: 'C:/Users/dev/app', remote: '/home/vscode/app' }]);
  });

  it('parses local=/remote pairs', () => {
    const map = parseRemotePathMap('C:\\Users\\dev\\app=/home/vscode/app');
    expect(map[0]?.local).toBe('C:/Users/dev/app');
    expect(map[0]?.remote).toBe('/home/vscode/app');
  });

  it('translates paths when Remote SSH enabled', () => {
    process.env.MASTYFF_AI_REMOTE_SSH = 'true';
    process.env.MASTYFF_AI_REMOTE_PATH_MAP = 'C:/Users/dev/app=/home/vscode/app';
    expect(translatePath('C:/Users/dev/app/src/main.ts')).toBe('/home/vscode/app/src/main.ts');
    expect(translatePath('/tmp/other')).toBe('/tmp/other');
  });

  it('isRemoteSshEnabled reflects env', () => {
    expect(isRemoteSshEnabled()).toBe(false);
    process.env.MASTYFF_AI_REMOTE_SSH = 'true';
    expect(isRemoteSshEnabled()).toBe(true);
  });
});
