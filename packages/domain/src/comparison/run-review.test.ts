import { describe, expect, it } from 'vite-plus/test';

import { getReviewedOutcome } from './run-review.ts';

describe('getReviewedOutcome', () => {
  it('is a success when the task was done', () => {
    expect(getReviewedOutcome({ reason: 'It wrote the file.', isTaskDone: true })).toEqual({
      status: 'succeeded',
    });
  });

  it('is incomplete, with the reason, when it was not', () => {
    expect(getReviewedOutcome({ reason: 'It asked a question.', isTaskDone: false })).toEqual({
      status: 'incomplete',
      reason: 'It asked a question.',
    });
  });
});
