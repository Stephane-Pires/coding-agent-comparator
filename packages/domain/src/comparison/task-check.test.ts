import { describe, expect, it } from 'vite-plus/test';

import { getVerdict } from './task-check.ts';

const reason = 'Why.';

describe('getVerdict', () => {
  it('accepts a coding task whose result is files', () => {
    expect(getVerdict({ reason, isCodingTask: true, hasFileResult: true })).toEqual({ verdict: 'accepted' });
  });

  it('refuses, with the reason, a task that is not about code or that leaves no file', () => {
    const refused = { verdict: 'refused', reason };
    expect(getVerdict({ reason, isCodingTask: false, hasFileResult: true })).toEqual(refused);
    expect(getVerdict({ reason, isCodingTask: true, hasFileResult: false })).toEqual(refused);
    expect(getVerdict({ reason, isCodingTask: false, hasFileResult: false })).toEqual(refused);
  });
});
