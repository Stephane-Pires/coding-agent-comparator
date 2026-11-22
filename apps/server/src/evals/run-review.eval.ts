// Measures the run review on the labelled runs of fixtures/run-review.json:
//   pnpm eval:run-review [api|claude-code]
// It calls a real model once per run, so it is not part of `pnpm check`. Run it after any change to the
// instructions (RUN_REVIEW_INSTRUCTIONS), to the model, or to an adapter.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { Task } from '@comparator/domain';

import { measure } from './measure.ts';
import { getRoute } from './route.ts';

/** Long enough for Claude Code to start and answer; a case that takes longer counts as an error. */
const ANSWER_TIMEOUT_MS = 90_000;

const Labelled = z.object({
  kind: z.string(),
  expect: z.enum(['done', 'not-done']),
  task: z.string(),
  answer: z.string(),
  files: z.array(z.string()),
  toolCalls: z.number(),
});

const path = join(import.meta.dirname, '../../../../fixtures/run-review.json');
const { runs } = z.object({ runs: z.array(Labelled) }).parse(JSON.parse(readFileSync(path, 'utf8')));
const { name, model, reviewer } = getRoute();

await measure({
  model: `${model}, through ${name}`,
  cases: runs,
  title: ({ task, answer }) => `${task} | ${answer}`.replaceAll('\n', ' '),
  answer: async ({ task, answer, files, toolCalls }) => {
    const work = { task: Task.parse(task), answer, files, toolCalls };
    const review = await reviewer.review(work, AbortSignal.timeout(ANSWER_TIMEOUT_MS));
    return { got: review.isTaskDone ? 'done' : 'not-done', reason: review.reason };
  },
  // Calling finished work incomplete is worse than missing an agent that stopped short.
  worst: { label: 'Done runs called not done', is: (_, got) => got === 'not-done' },
});
