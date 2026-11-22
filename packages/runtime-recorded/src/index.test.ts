import { describe, expect, it } from 'vite-plus/test';

import { checkTask, reviewRun, startRun } from '@comparator/application';
import { Task, type RunEvent } from '@comparator/domain';

import { recordedRuntime, type Recording } from './index.ts';

const usage = { inputTokens: 10, cachedInputTokens: 4, outputTokens: 2, costUsd: null };
const totals = (files: number) => ({ model: 'a-model', durationMs: 5000, usage, toolCalls: 1, files });
const file = { path: 'hello.mjs', content: 'console.log("hi");\n', state: 'complete' } as const;
const wrote = {
  kind: 'tool-call',
  call: { id: 'c1', tool: { type: 'command', command: 'node hello.mjs' }, status: 'succeeded', output: 'hi' },
} as const;

/** A run that wrote a file, as a real one is recorded. */
const DONE: RunEvent[] = [
  { kind: 'message', text: 'I will write the file.' },
  wrote,
  { kind: 'file', file },
  { kind: 'message', text: 'Done.' },
  { kind: 'metrics', metrics: totals(1) },
  { kind: 'finished', outcome: { status: 'succeeded' } },
];
/** A run whose agent only asked a question. */
const ASKED: RunEvent[] = [
  { kind: 'message', text: 'Where is the project?' },
  { kind: 'metrics', metrics: { ...totals(0), toolCalls: 0 } },
  { kind: 'finished', outcome: { status: 'incomplete', reason: 'It asked where the project is.' } },
];
const RECORDINGS: Recording[] = [
  { task: 'write hello', verdict: { verdict: 'accepted' }, runs: { 'claude-code': DONE, codex: DONE } },
  { task: 'add tests', verdict: { verdict: 'accepted' }, runs: { 'claude-code': ASKED } },
  { task: 'hello', verdict: { verdict: 'refused', reason: 'A greeting.' }, runs: {} },
];

/** The real use cases, on the recorded runtime, with no pause between events. */
function replay(task: string) {
  const { agents, workspaces, classifier, reviewer } = recordedRuntime(RECORDINGS, { paceMs: 0 });
  const run = startRun({
    agents,
    workspaces,
    clock: { now: () => 0 },
    checkTask: checkTask(classifier),
    reviewRun: reviewRun(reviewer),
  });
  const signal = new AbortController().signal;
  return Array.fromAsync(run('claude-code', Task.parse(task), signal));
}
/** A run without its duration, which is the replay's own. */
const timeless = (events: readonly RunEvent[]) =>
  events.map((event) =>
    event.kind === 'metrics' ? { ...event, metrics: { ...event.metrics, durationMs: 0 } } : event,
  );

describe('recordedRuntime', () => {
  it('replays a run as it was recorded: messages, tool calls, files, totals and outcome', async () => {
    expect(await replay('write hello')).toEqual(timeless(DONE));
  });

  it('replays an incomplete run as incomplete, with its reason', async () => {
    expect(await replay('add tests')).toEqual(timeless(ASKED));
  });

  it('refuses a task that was refused when it was recorded, and starts nothing', async () => {
    expect(await replay('hello')).toEqual([
      { kind: 'finished', outcome: { status: 'failed', reason: 'A greeting.' } },
    ]);
  });

  it('answers a task it has no recording of with the first accepted one', async () => {
    expect(await replay('something else entirely')).toEqual(timeless(DONE));
  });
});
