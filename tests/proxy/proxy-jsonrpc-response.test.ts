import { describe, it, expect } from 'vitest';
import { JsonRpcResponseTracker } from '../../src/proxy/proxy-jsonrpc-response.js';
import { StdioLineWriter } from '../../src/proxy/proxy-stdio-writer.js';

describe('JsonRpcResponseTracker', () => {
  it('suppresses duplicate sendError for the same id', async () => {
    const lines: string[] = [];
    const writer = new StdioLineWriter((l) => {
      lines.push(l);
      return true;
    });
    const tracker = new JsonRpcResponseTracker();

    expect(tracker.sendError(writer, 42, -32001, 'first')).toBe(true);
    expect(tracker.sendError(writer, 42, -32001, 'second')).toBe(false);
    await writer.drain();

    expect(lines).toHaveLength(1);
    const body = JSON.parse(lines[0]!.trimEnd());
    expect(body.error.message).toBe('first');
  });

  it('allows a new response after clearResponded', async () => {
    const lines: string[] = [];
    const writer = new StdioLineWriter((l) => {
      lines.push(l);
      return true;
    });
    const tracker = new JsonRpcResponseTracker();

    tracker.sendError(writer, 7, -32001, 'one');
    tracker.clearResponded(7);
    tracker.sendError(writer, 7, -32002, 'two');
    await writer.drain();

    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[1]!.trimEnd()).error.message).toBe('two');
  });
});
