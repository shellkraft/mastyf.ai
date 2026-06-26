import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isRedisSemanticQueueEnabled,
  semanticQueueMax,
  tryAcquireRedisSemanticSlot,
  releaseRedisSemanticSlot,
} from '../../src/utils/redis-semantic-queue.js';

const evalMock = vi.fn();

vi.mock('../../src/utils/redis-client.js', () => ({
  isRedisConfigured: () => true,
  getSharedRedisClient: () => ({
    eval: evalMock,
    get: vi.fn().mockResolvedValue('2'),
  }),
}));

describe('redis-semantic-queue (M-001)', () => {
  beforeEach(() => {
    delete process.env.MASTYF_AI_SEMANTIC_QUEUE_LOCAL;
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    evalMock.mockReset();
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.MASTYF_AI_SEMANTIC_ASYNC_MAX_QUEUE;
  });

  it('uses Redis when configured and local override is off', () => {
    expect(isRedisSemanticQueueEnabled()).toBe(true);
  });

  it('acquire calls Redis eval with cluster cap', async () => {
    process.env.MASTYF_AI_SEMANTIC_ASYNC_MAX_QUEUE = '10';
    evalMock.mockResolvedValue(1);
    const ok = await tryAcquireRedisSemanticSlot('tenant-a');
    expect(ok).toBe(true);
    expect(evalMock).toHaveBeenCalled();
    const args = evalMock.mock.calls[0];
    expect(args[4]).toBe(semanticQueueMax());
  });

  it('release calls Redis eval', async () => {
    evalMock.mockResolvedValue(1);
    await releaseRedisSemanticSlot('tenant-a');
    expect(evalMock).toHaveBeenCalled();
  });
});
