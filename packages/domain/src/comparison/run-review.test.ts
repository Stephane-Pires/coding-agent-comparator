import { describe, expect, it } from 'vite-plus/test';

import { reviewedOutcome } from './run-review.ts';

describe('reviewedOutcome', () => {
  it('is a success when the task was done', () => {
    expect(reviewedOutcome({ reason: 'It wrote the file.', taskDone: true })).toEqual({
      status: 'succeeded',
    });
  });

  it('is incomplete, with the reason, when it was not', () => {
    expect(reviewedOutcome({ reason: 'It asked a question.', taskDone: false })).toEqual({
      status: 'incomplete',
      reason: 'It asked a question.',
    });
  });
});
