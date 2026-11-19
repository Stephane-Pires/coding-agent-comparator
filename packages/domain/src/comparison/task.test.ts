import { describe, expect, it } from 'vite-plus/test';

import { Task, TASK_MAX_LENGTH } from './task.ts';

describe('Task', () => {
  it('trims the text', () => {
    expect(Task.parse('  write a script \n')).toBe('write a script');
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   \n'],
    ['over the length cap', 'a'.repeat(TASK_MAX_LENGTH + 1)],
  ])('rejects a task that is %s', (_label, text) => {
    expect(Task.safeParse(text).success).toBe(false);
  });

  it('accepts a task at the length cap', () => {
    expect(Task.safeParse('a'.repeat(TASK_MAX_LENGTH)).success).toBe(true);
  });
});
