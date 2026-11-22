// Measures the task check on the labelled tasks of fixtures/task-check.json:
//   pnpm eval:task-check [api|claude-code]
// It calls a real model once per task, so it is not part of `pnpm check`. Run it after any change to the
// instructions (TASK_CHECK_INSTRUCTIONS), to the model, or to an adapter.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { Task, getVerdict } from '@comparator/domain';

import { measure } from './measure.ts';
import { getRoute } from './route.ts';

/** Long enough for Claude Code to start and answer; a case that takes longer counts as an error. */
const ANSWER_TIMEOUT_MS = 90_000;

const Labelled = z.object({ kind: z.string(), expect: z.enum(['accepted', 'refused']), task: z.string() });

const path = join(import.meta.dirname, '../../../../fixtures/task-check.json');
const { tasks } = z.object({ tasks: z.array(Labelled) }).parse(JSON.parse(readFileSync(path, 'utf8')));
const { name, model, classifier } = getRoute();

await measure({
  model: `${model}, through ${name}`,
  cases: tasks,
  title: ({ task }) => task,
  answer: async ({ task }) => {
    const assessment = await classifier.assess(Task.parse(task), AbortSignal.timeout(ANSWER_TIMEOUT_MS));
    return { got: getVerdict(assessment).verdict, reason: assessment.reason };
  },
  // Refusing real work is worse than letting a poem through.
  worst: {
    label: 'Plain coding tasks refused',
    is: ({ kind }, got) => got === 'refused' && ['coding', 'other-language'].includes(kind),
  },
});
