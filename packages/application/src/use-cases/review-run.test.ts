import { describe, expect, it } from 'vite-plus/test';

import { Task } from '@comparator/domain';

import { scriptedReviewer } from '../testing/index.ts';
import { reviewRun } from './review-run.ts';

const work = { task: Task.parse('write a function'), answer: 'What should it do?', files: [], toolCalls: 0 };
const signal = new AbortController().signal;

describe('reviewRun', () => {
  it('is a success when the reviewer says the task was done, and shows the reviewer the work', async () => {
    const reviewer = scriptedReviewer({ reason: 'It wrote it.', isTaskDone: true });
    expect(await reviewRun({ reviewer })({ work, signal })).toEqual({ status: 'succeeded' });
    expect(reviewer.reviewed).toEqual([work]);
  });

  it("is incomplete, with the reviewer's reason, when the task was not done", async () => {
    const reviewer = scriptedReviewer({ reason: 'It asked a question.', isTaskDone: false });
    expect(await reviewRun({ reviewer })({ work, signal })).toEqual({
      status: 'incomplete',
      reason: 'It asked a question.',
    });
  });

  it('gives the benefit of the doubt when the reviewer cannot answer', async () => {
    const reviewer = scriptedReviewer(new Error('no login'));
    expect(await reviewRun({ reviewer })({ work, signal })).toEqual({ status: 'succeeded' });
  });
});
