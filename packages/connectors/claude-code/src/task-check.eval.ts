// Measures the task check on the labelled tasks of fixtures/task-check.json: `pnpm eval:task-check [model]`.
// It calls a real model once per task, so it is not part of `pnpm check`. Run it after any change to the
// instructions (TASK_CHECK_INSTRUCTIONS) or to the model.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { Task, verdictOf } from '@comparator/domain';

import { claudeCodeTaskClassifier } from './classifier.ts';

const Labelled = z.object({ kind: z.string(), expect: z.enum(['accepted', 'refused']), task: z.string() });
type Labelled = z.infer<typeof Labelled>;
interface Outcome extends Labelled {
  readonly got: 'accepted' | 'refused' | 'error';
  readonly reason: string;
  readonly ms: number;
}

const CONCURRENCY = 4;
const model = process.argv[2] ?? 'haiku';
const path = join(import.meta.dirname, '../../../../fixtures/task-check.json');
const { tasks } = z.object({ tasks: z.array(Labelled) }).parse(JSON.parse(readFileSync(path, 'utf8')));
const classifier = claudeCodeTaskClassifier({ model, apiKey: process.env['ANTHROPIC_API_KEY'] || undefined });

async function run(labelled: Labelled): Promise<Outcome> {
  const startedAt = performance.now();
  try {
    const assessment = await classifier.assess(Task.parse(labelled.task), AbortSignal.timeout(90_000));
    const got = verdictOf(assessment).verdict;
    return { ...labelled, got, reason: assessment.reason, ms: performance.now() - startedAt };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { ...labelled, got: 'error', reason, ms: performance.now() - startedAt };
  }
}

const outcomes: Outcome[] = [];
const queue = [...tasks];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const outcome = await run(next);
      outcomes.push(outcome);
      console.log(
        `${outcome.got === outcome.expect ? 'ok  ' : 'MISS'} ${outcome.kind.padEnd(14)} ${outcome.task.slice(0, 70)}`,
      );
    }
  }),
);

const misses = outcomes.filter((outcome) => outcome.got !== outcome.expect);
const falseRefusals = misses.filter(
  ({ kind, got }) => got === 'refused' && ['coding', 'other-language'].includes(kind),
);
const times = outcomes.map(({ ms }) => ms).toSorted((a, b) => a - b);
console.log(`\nModel: ${model}`);
console.log(`Score: ${outcomes.length - misses.length} of ${outcomes.length}`);
console.log(`Plain coding tasks refused: ${falseRefusals.length}`);
console.log(
  `Time per check: median ${Math.round(times[Math.floor(times.length / 2)] ?? 0)} ms, slowest ${Math.round(times.at(-1) ?? 0)} ms (${CONCURRENCY} at a time)`,
);
for (const miss of misses)
  console.log(
    `\nMISS (${miss.kind}) expected ${miss.expect}, got ${miss.got}\n  task:   ${miss.task}\n  reason: ${miss.reason}`,
  );
process.exitCode = misses.length === 0 ? 0 : 1;
