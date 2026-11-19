import { describe, expect, it } from 'vite-plus/test';

import { countTokens } from './usage.ts';

describe('counting tokens', () => {
  it('counts as input everything the model read, cached or not, and gives the cached part beside it', () => {
    expect(countTokens({ uncachedInput: 8186, cachedInput: 48_000, output: 277 })).toEqual({
      inputTokens: 56_186,
      cachedInputTokens: 48_000,
      outputTokens: 277,
    });
  });

  it('counts nothing as cached when the agent read nothing from the cache', () => {
    expect(countTokens({ uncachedInput: 120, cachedInput: 0, output: 30 })).toEqual({
      inputTokens: 120,
      cachedInputTokens: 0,
      outputTokens: 30,
    });
  });
});
