import { describe, it, expect } from 'vitest';
import { StdioLineWriter } from '../../src/proxy/proxy-stdio-writer.js';

describe('StdioLineWriter', () => {
  it('serializes concurrent writes into atomic lines', async () => {
    const chunks: string[] = [];
    const writer = new StdioLineWriter((line) => {
      chunks.push(line);
      return true;
    });

    writer.writeLine('{"a":1}');
    writer.writeLine('{"b":2}');
    writer.writeLine('{"c":3}');
    await writer.drain();

    expect(chunks).toEqual(['{"a":1}\n', '{"b":2}\n', '{"c":3}\n']);
    for (const chunk of chunks) {
      expect(chunk.endsWith('\n')).toBe(true);
      expect(() => JSON.parse(chunk.trimEnd())).not.toThrow();
    }
  });

  it('does not double-append newline', async () => {
    const chunks: string[] = [];
    const writer = new StdioLineWriter((line) => {
      chunks.push(line);
      return true;
    });
    writer.writeLine('ok\n');
    await writer.drain();
    expect(chunks).toEqual(['ok\n']);
  });
});
