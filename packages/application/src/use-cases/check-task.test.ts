import { describe, expect, it } from 'vite-plus/test';

import { Task } from '@comparator/domain';

import { scriptedClassifier } from '../testing/index.ts';
import { checkTask } from './check-task.ts';

const task = Task.parse('write a poem');
const signal = new AbortController().signal;

describe('checkTask', () => {
  it('accepts a coding task whose result is files, and asks about the task it was given', async () => {
    const classifier = scriptedClassifier({ reason: 'A script.', isCodingTask: true, hasFileResult: true });
    expect(await checkTask(classifier)(task, signal)).toEqual({ verdict: 'accepted' });
    expect(classifier.asked).toEqual([task]);
  });

  it("refuses any other task, with the classifier's reason", async () => {
    const classifier = scriptedClassifier({ reason: 'Not code.', isCodingTask: false, hasFileResult: false });
    expect(await checkTask(classifier)(task, signal)).toEqual({
      verdict: 'refused',
      reason: 'Not code.',
    });
  });

  it('asks the classifier once for a task, then remembers its verdict', async () => {
    const classifier = scriptedClassifier({ reason: 'Not code.', isCodingTask: false, hasFileResult: false });
    const check = checkTask(classifier);
    await check(task, signal);
    expect(await check(task, signal)).toEqual({ verdict: 'refused', reason: 'Not code.' });
    expect(classifier.asked).toHaveLength(1);
  });

  it('asks again after an answer the classifier could not give', async () => {
    const classifier = scriptedClassifier(new Error('no login'));
    const check = checkTask(classifier);
    await check(task, signal);
    await check(task, signal);
    expect(classifier.asked).toHaveLength(2);
  });

  it('accepts the task when the classifier cannot answer: the check never stops the product', async () => {
    const classifier = scriptedClassifier(new Error('no login'));
    expect(await checkTask(classifier)(task, signal)).toEqual({ verdict: 'accepted' });
  });
});
