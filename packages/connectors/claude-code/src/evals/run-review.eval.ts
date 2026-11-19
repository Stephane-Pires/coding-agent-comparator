// Measures the run review on the labelled runs of fixtures/run-review.json: `pnpm eval:run-review [model]`.
// It calls a real model once per run, so it is not part of `pnpm check`. Run it after any change to the
// instructions (RUN_REVIEW_INSTRUCTIONS) or to the model.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { Task } from '@comparator/domain';

import { claudeCodeRunReviewer } from '../reviewer.ts';
import { measure } from './measure.ts';

const Labelled = z.object({
  kind: z.string(),
  expect: z.enum(['done', 'not-done']),
  task: z.string(),
  answer: z.string(),
  files: z.array(z.string()),
  toolCalls: z.number(),
});

const model = process.argv[2] ?? 'haiku';
const path = join(import.meta.dirname, '../../../../../fixtures/run-review.json');
const { runs } = z.object({ runs: z.array(Labelled) }).parse(JSON.parse(readFileSync(path, 'utf8')));
const reviewer = claudeCodeRunReviewer({ model, apiKey: process.env['ANTHROPIC_API_KEY'] || undefined });

await measure({
  model,
  cases: runs,
  title: ({ task, answer }) => `${task} | ${answer}`.replaceAll('\n', ' '),
  answer: async ({ task, answer, files, toolCalls }) => {
    const work = { task: Task.parse(task), answer, files, toolCalls };
    const review = await reviewer.review(work, AbortSignal.timeout(90_000));
    return { got: review.taskDone ? 'done' : 'not-done', reason: review.reason };
  },
  // Calling finished work incomplete is worse than missing an agent that stopped short.
  worst: { label: 'Done runs called not done', is: (_, got) => got === 'not-done' },
});
