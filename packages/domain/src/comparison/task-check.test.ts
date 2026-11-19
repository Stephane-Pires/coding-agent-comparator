import { describe, expect, it } from 'vite-plus/test';

import { verdictOf } from './task-check.ts';

const reason = 'Why.';

describe('verdictOf', () => {
  it('accepts a coding task whose result is files', () => {
    expect(verdictOf({ reason, isCodingTask: true, resultIsFiles: true })).toEqual({ verdict: 'accepted' });
  });

  it('refuses, with the reason, a task that is not about code or that leaves no file', () => {
    const refused = { verdict: 'refused', reason };
    expect(verdictOf({ reason, isCodingTask: false, resultIsFiles: true })).toEqual(refused);
    expect(verdictOf({ reason, isCodingTask: true, resultIsFiles: false })).toEqual(refused);
    expect(verdictOf({ reason, isCodingTask: false, resultIsFiles: false })).toEqual(refused);
  });
});
