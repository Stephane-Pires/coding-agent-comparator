import { describe, expect, it } from 'vite-plus/test';

import { getCourseLength } from './run-tracks.tsx';

describe('courseLength', () => {
  it('while a run lasts, goes a little ahead of the clock', () => {
    expect(getCourseLength(0, [undefined, undefined])).toBe(2000);
    expect(getCourseLength(4000, [undefined, 1500])).toBe(6000);
  });

  it('once every run has ended, stops at the furthest one: nothing is redrawn', () => {
    expect(getCourseLength(60_000, [3800, 9500])).toBe(9500);
  });
});
