// Makes the recordings that the `recorded` runtime replays: `pnpm fixtures:record`.
// It runs each task below on the real agents, through the real use cases, and saves what happened. It uses your
// keys or logins, so run it by hand: after an upgrade of an agent's SDK, once the live test passes.
import { existsSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AgentId, Task, type RunEvent } from '@comparator/domain';
import type { Recording } from '@comparator/runtime-recorded';

import { readConfig } from './config.ts';
import { createContainer } from './container.ts';
import { machineRuntime, RECORDINGS_FILE } from './runtimes/local.ts';

/** One task per thing the end-to-end test looks at. The first is what any other task is answered with. */
const TASKS = [
  // Both agents write a file and run a command.
  'Create hello.mjs that prints hi, then run it.',
  // Not a coding task: refused, and no agent starts.
  'hello',
  // Nothing to work on in an empty folder: an agent stops cleanly without doing it.
  'Add unit tests to the existing project.',
];

const envFile = join(import.meta.dirname, '../../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const config = readConfig(process.env);
if (config.isErr()) throw new Error(config.error);
const { checkTask, startRun } = createContainer(machineRuntime({ ...config.value, runtime: 'local' }));
const signal = new AbortController().signal;

const recordings: Recording[] = [];
for (const text of TASKS) {
  const task = Task.parse(text);
  const verdict = await checkTask(task, signal);
  const runs: Recording['runs'] = {};
  if (verdict.verdict === 'accepted')
    await Promise.all(
      AgentId.options.map(async (agent) => {
        runs[agent] = await Array.fromAsync(startRun(agent, task, signal));
      }),
    );
  const endings = Object.entries(runs).map(([agent, events]: [string, RunEvent[]]) => {
    const end = events.at(-1);
    return `${agent} ${end?.kind === 'finished' ? end.outcome.status : 'did not end'}`;
  });
  console.log(`${verdict.verdict.padEnd(8)} ${text}  ${endings.join(', ')}`);
  recordings.push({ task, verdict, runs });
}
// The workspaces are temporary folders of this machine: their path is shown as `/tmp`, not as this machine's.
const saved = JSON.stringify(recordings, null, 2).replaceAll(realpathSync(tmpdir()), '/tmp');
writeFileSync(RECORDINGS_FILE, `${saved}\n`);
console.log(`Saved ${recordings.length} recordings to fixtures/recordings.json`);
