// Measures the task check on the labelled tasks of fixtures/task-check.json: `pnpm eval:task-check [model]`.
// It calls a real model once per task, so it is not part of `pnpm check`. Run it after any change to the
// instructions (TASK_CHECK_INSTRUCTIONS) or to the model.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { Task, verdictOf } from '@comparator/domain';

import { claudeCodeTaskClassifier } from '../classifier.ts';
import { measure } from './measure.ts';

const Labelled = z.object({ kind: z.string(), expect: z.enum(['accepted', 'refused']), task: z.string() });

const model = process.argv[2] ?? 'haiku';
const path = join(import.meta.dirname, '../../../../../fixtures/task-check.json');
const { tasks } = z.object({ tasks: z.array(Labelled) }).parse(JSON.parse(readFileSync(path, 'utf8')));
const classifier = claudeCodeTaskClassifier({ model, apiKey: process.env['ANTHROPIC_API_KEY'] || undefined });

await measure({
  model,
  cases: tasks,
  title: ({ task }) => task,
  answer: async ({ task }) => {
    const assessment = await classifier.assess(Task.parse(task), AbortSignal.timeout(90_000));
    return { got: verdictOf(assessment).verdict, reason: assessment.reason };
  },
  // Refusing real work is worse than letting a poem through.
  worst: {
    label: 'Plain coding tasks refused',
    is: ({ kind }, got) => got === 'refused' && ['coding', 'other-language'].includes(kind),
  },
});
