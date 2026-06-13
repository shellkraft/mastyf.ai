import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getLlmCache,
  isLlmCacheEnabled,
  resetLlmCacheForTests,
} from '../../src/ai/llm-cache.js';
import { resetLlmConfigForTests } from '../../src/config/llm-config.js';

describe('llm-cache', () => {
  const prevRedis = process.env.REDIS_URL;
  const prevCacheFlag = process.env.MASTYFF_AI_LLM_CACHE;
  const prevTtl = process.env.MASTYFF_AI_LLM_CACHE_TTL_SEC;

  beforeEach(() => {
    resetLlmCacheForTests();
    resetLlmConfigForTests();
    delete process.env.REDIS_URL;
    process.env.MASTYFF_AI_LLM_CACHE = 'true';
    process.env.MASTYFF_AI_LLM_CACHE_TTL_SEC = '60';
  });

  afterEach(() => {
    resetLlmCacheForTests();
    resetLlmConfigForTests();
    if (prevRedis === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prevRedis;
    if (prevCacheFlag === undefined) delete process.env.MASTYFF_AI_LLM_CACHE;
    else process.env.MASTYFF_AI_LLM_CACHE = prevCacheFlag;
    if (prevTtl === undefined) delete process.env.MASTYFF_AI_LLM_CACHE_TTL_SEC;
    else process.env.MASTYFF_AI_LLM_CACHE_TTL_SEC = prevTtl;
  });

  it('enables cache by default when REDIS_URL is set', () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    delete process.env.MASTYFF_AI_LLM_CACHE;
    expect(isLlmCacheEnabled()).toBe(true);
  });

  it('disables cache when MASTYFF_AI_LLM_CACHE=false', () => {
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    process.env.MASTYFF_AI_LLM_CACHE = 'false';
    expect(isLlmCacheEnabled()).toBe(false);
  });

  it('uses in-memory LRU when enabled without REDIS_URL', async () => {
    const cache = getLlmCache();
    const key = {
      model: 'qwen3:8b',
      system: 'sys',
      prompt: 'user',
      temperature: 0.1,
    };

    expect(await cache.get(key)).toBeNull();
    await cache.set(key, '{"ok":true}');
    expect(await cache.get(key)).toBe('{"ok":true}');
  });

  it('returns distinct values for different cache keys', async () => {
    const cache = getLlmCache();
    const base = { model: 'm', system: 's', temperature: 0.1 };
    await cache.set({ ...base, prompt: 'a' }, 'A');
    await cache.set({ ...base, prompt: 'b' }, 'B');
    expect(await cache.get({ ...base, prompt: 'a' })).toBe('A');
    expect(await cache.get({ ...base, prompt: 'b' })).toBe('B');
  });

  it('forces LRU-only path when MASTYFF_AI_LLM_CACHE=true without REDIS_URL', async () => {
    process.env.MASTYFF_AI_LLM_CACHE = 'true';
    delete process.env.REDIS_URL;
    const cache = getLlmCache();
    const key = {
      model: 'claude-haiku',
      system: 'analyze',
      prompt: 'tool x',
      temperature: 0.2,
    };
    await cache.set(key, 'cached-body');
    expect(await cache.get(key)).toBe('cached-body');
  });
});
