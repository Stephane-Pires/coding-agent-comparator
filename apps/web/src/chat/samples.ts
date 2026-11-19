import type { SampleTask } from '@comparator/ui/components/task-input';

/** Small tasks that show what the comparator is for. Each makes an agent write a file and run something. */
export const SAMPLE_TASKS: readonly SampleTask[] = [
  {
    label: 'Hello script',
    task: 'Create hello.mjs that prints "hi", then run it with node and tell me what it printed.',
  },
  {
    label: 'Tested function',
    task: 'Write a slugify(text) function in slugify.mjs, with tests in slugify.test.mjs using node:test. Run the tests and report the result.',
  },
  {
    label: 'Find and fix',
    task: 'Create fizzbuzz.mjs that prints FizzBuzz from 1 to 15, run it, and check the output is correct. Fix it if it is not.',
  },
];
