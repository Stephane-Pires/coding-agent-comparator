import { describe, expect, it } from 'vite-plus/test';

import { Task, type AgentEvent, type Metrics, type RunEvent, type WorkspaceFile } from '@comparator/domain';

import type { RunWork } from '../ports/run-reviewer.ts';
import { inMemoryWorkspaces, scriptedAgent, tickingClock, type Step } from '../testing/index.ts';
import type { CheckTask } from './check-task.ts';
import type { ReviewRun } from './review-run.ts';
import { startRun } from './start-run.ts';

const task = Task.parse('write a script');
/** An event an agent reports and a run passes on unchanged. */
type Shared = AgentEvent & RunEvent;
const message = (text: string): Shared => ({ kind: 'message', text });
const succeeded: Shared = { kind: 'finished', outcome: { status: 'succeeded' } };
const cancelled: Shared = { kind: 'finished', outcome: { status: 'cancelled' } };
const failed = (reason: string): Shared => ({ kind: 'finished', outcome: { status: 'failed', reason } });
const file = (path: string, content: string): WorkspaceFile => ({ path, content, state: 'complete' });
const changed = (f: WorkspaceFile): RunEvent => ({ kind: 'file', file: f });
const call = (status: 'running' | 'succeeded', id = 'c1'): Shared => ({
  kind: 'tool-call',
  call: { id, tool: { type: 'command', command: 'node write.mjs' }, status, output: '' },
});

const accepts: CheckTask = () => Promise.resolve({ verdict: 'accepted' });
const done: ReviewRun = () => Promise.resolve({ status: 'succeeded' });
const asksBack: ReviewRun = () => Promise.resolve({ status: 'incomplete', reason: 'It asked a question.' });
const refuses: CheckTask = () => Promise.resolve({ verdict: 'refused', reason: 'Not a coding task.' });

function setup(
  steps: readonly Step[],
  workspaces = inMemoryWorkspaces(),
  checkTask = accepts,
  reviewRun = done,
) {
  const claude = scriptedAgent(steps);
  const codex = scriptedAgent([message('from codex'), succeeded]);
  const controller = new AbortController();
  // Each reading of the clock is 750 ms after the one before: a run reads it at its start and at its end.
  const run = startRun({
    agents: { 'claude-code': claude, codex },
    workspaces,
    clock: tickingClock(750),
    checkTask,
    reviewRun,
  });
  const all = () => Array.fromAsync(run('claude-code', task, controller.signal));
  /** The run without its totals, which have their own tests. */
  const events = async () => (await all()).filter((event) => event.kind !== 'metrics');
  const metrics = async (): Promise<Metrics[]> =>
    (await all()).flatMap((event) => (event.kind === 'metrics' ? [event.metrics] : []));
  return { claude, codex, workspaces, controller, run, all, events, metrics };
}

describe('startRun', () => {
  describe('the review of a run whose agent stopped without error', () => {
    it('ends the run as incomplete when the task was not done, with its totals', async () => {
      const { all } = setup(
        [message('What should it do?'), succeeded],
        inMemoryWorkspaces(),
        accepts,
        asksBack,
      );
      const events = await all();
      expect(events.at(-1)).toEqual({
        kind: 'finished',
        outcome: { status: 'incomplete', reason: 'It asked a question.' },
      });
      expect(events.at(-2)).toMatchObject({ kind: 'metrics' });
    });

    it('shows the reviewer the task, what the agent said, the files it left and how many tools it called', async () => {
      const seen: RunWork[] = [];
      const watching: ReviewRun = (work) => {
        seen.push(work);
        return Promise.resolve({ status: 'succeeded' });
      };
      const workspaces = inMemoryWorkspaces({ reads: [[file('a.mjs', '1')]] });
      await setup(
        [message('one'), call('succeeded'), message('two'), succeeded],
        workspaces,
        accepts,
        watching,
      ).all();
      expect(seen).toEqual([{ task, answer: 'one\n\ntwo', files: ['a.mjs'], toolCalls: 1 }]);
    });

    it('does not count the review in the duration of the run', async () => {
      // The clock is read at the start and before the review: 750 ms apart, whatever the review takes.
      const { metrics } = setup([succeeded], inMemoryWorkspaces(), accepts, asksBack);
      expect(await metrics()).toMatchObject([{ durationMs: 750 }]);
    });

    it('is not asked for a run that failed', async () => {
      const seen: RunWork[] = [];
      const watching: ReviewRun = (work) => {
        seen.push(work);
        return Promise.resolve({ status: 'succeeded' });
      };
      await setup([failed('boom')], inMemoryWorkspaces(), accepts, watching).all();
      expect(seen).toHaveLength(0);
    });
  });

  it('starts nothing for a refused task: no workspace, no agent, and the reason as the failure', async () => {
    const { all, claude, workspaces } = setup([message('one'), succeeded], inMemoryWorkspaces(), refuses);
    expect(await all()).toEqual([failed('Not a coding task.')]);
    expect(claude.runs).toHaveLength(0);
    expect(workspaces.created).toHaveLength(0);
  });

  it('yields what the agent does, in order, until it finishes', async () => {
    const { events } = setup([message('one'), message('two'), succeeded]);
    expect(await events()).toEqual([message('one'), message('two'), succeeded]);
  });

  it('runs the chosen agent only, with the task, a fresh workspace and the signal', async () => {
    const { claude, codex, workspaces, controller, events } = setup([succeeded]);
    await events();
    expect(claude.runs).toEqual([{ task, workspace: workspaces.created[0], signal: controller.signal }]);
    expect(codex.runs).toEqual([]);
  });

  it('gives each run its own workspace', async () => {
    const { workspaces, events } = setup([succeeded]);
    await events();
    await events();
    expect(workspaces.created).toHaveLength(2);
    expect(workspaces.created[0]).not.toEqual(workspaces.created[1]);
  });

  it('passes on a failure the agent reports', async () => {
    const { events } = setup([message('trying'), failed('model not found')]);
    expect(await events()).toEqual([message('trying'), failed('model not found')]);
  });

  it('ignores what an agent does after it finished, including a thrown error', async () => {
    const { events } = setup([failed('model not found'), { throws: new Error('exited with code 1') }]);
    expect(await events()).toEqual([failed('model not found')]);
  });

  it('turns a crash into a failed run', async () => {
    const { events } = setup([message('one'), { throws: new Error('process crashed') }]);
    expect(await events()).toEqual([message('one'), failed('process crashed')]);
  });

  it('fails a run whose agent stops without a result', async () => {
    const { events } = setup([message('one')]);
    expect(await events()).toEqual([message('one'), failed('The agent stopped without reporting a result.')]);
  });

  it('ends as cancelled when the run is aborted and the agent throws', async () => {
    const { controller, run } = setup([message('one'), 'wait-for-abort', { throws: new Error('aborted') }]);
    const seen: RunEvent[] = [];
    for await (const event of run('claude-code', task, controller.signal)) {
      seen.push(event);
      controller.abort();
    }
    expect(seen).toEqual([message('one'), cancelled]);
  });

  it('ends as cancelled when the run is aborted and the agent just stops', async () => {
    const { controller, run } = setup([message('one'), 'wait-for-abort']);
    const seen: RunEvent[] = [];
    for await (const event of run('claude-code', task, controller.signal)) {
      seen.push(event);
      controller.abort();
    }
    expect(seen).toEqual([message('one'), cancelled]);
  });

  it('fails the run, and starts no agent, when no workspace can be created', async () => {
    const { claude, events } = setup([succeeded], inMemoryWorkspaces({ failWith: 'disk full' }));
    expect(await events()).toEqual([failed('disk full')]);
    expect(claude.runs).toEqual([]);
  });

  it.each<[string, readonly Step[]]>([
    ['success', [succeeded]],
    ['a reported failure', [failed('no')]],
    ['a crash', [{ throws: new Error('crash') }]],
    ['a silent stop', []],
  ])('disposes of the workspace after %s', async (_label, steps) => {
    const { workspaces, events } = setup(steps);
    await events();
    expect(workspaces.disposed).toEqual(workspaces.created);
  });

  describe('the files of the workspace', () => {
    it('yields the files that changed after each tool call that ended, and before the end', async () => {
      const a1 = file('a.mjs', '1');
      const a2 = file('a.mjs', '2');
      const b = file('src/b.mjs', 'b');
      const { events } = setup(
        [call('running'), call('succeeded'), message('done'), succeeded],
        inMemoryWorkspaces({ reads: [[a1], [a2, b]] }),
      );
      expect(await events()).toEqual([
        call('running'),
        call('succeeded'),
        changed(a1),
        message('done'),
        changed(a2),
        changed(b),
        succeeded,
      ]);
    });

    it('yields a file once while it does not change', async () => {
      const a = file('a.mjs', '1');
      const { events } = setup([call('succeeded'), succeeded], inMemoryWorkspaces({ reads: [[a]] }));
      expect(await events()).toEqual([call('succeeded'), changed(a), succeeded]);
    });

    it('yields a file that is gone once more, as deleted', async () => {
      const a = file('a.mjs', '1');
      const { events } = setup([call('succeeded'), succeeded], inMemoryWorkspaces({ reads: [[a], []] }));
      expect(await events()).toEqual([
        call('succeeded'),
        changed(a),
        changed({ path: 'a.mjs', content: '', state: 'deleted' }),
        succeeded,
      ]);
    });

    it.each<[string, readonly Step[], RunEvent]>([
      ['failed', [failed('no')], failed('no')],
      ['crashed', [{ throws: new Error('crash') }], failed('crash')],
    ])('still yields the files left by a run that %s', async (_label, steps, end) => {
      const a = file('a.mjs', '1');
      const { events } = setup(steps, inMemoryWorkspaces({ reads: [[a]] }));
      expect(await events()).toEqual([changed(a), end]);
    });

    it('does not read the workspace of a cancelled run', async () => {
      const workspaces = inMemoryWorkspaces({ reads: [[file('a.mjs', '1')]] });
      const { controller, run } = setup([message('one'), 'wait-for-abort'], workspaces);
      const seen: RunEvent[] = [];
      for await (const event of run('claude-code', task, controller.signal)) {
        seen.push(event);
        controller.abort();
      }
      expect(seen).toEqual([message('one'), cancelled]);
    });
  });

  describe('the totals of the run', () => {
    const usage = { inputTokens: 1200, cachedInputTokens: 800, outputTokens: 90, costUsd: 0.012 };

    it('gives the totals once, just before the end, and keeps the usage out of the run', async () => {
      const { all } = setup([
        { kind: 'model', model: 'a-model' },
        message('one'),
        { kind: 'usage', usage },
        succeeded,
      ]);
      expect(await all()).toEqual([
        message('one'),
        { kind: 'metrics', metrics: { model: 'a-model', durationMs: 750, usage, toolCalls: 0, files: 0 } },
        succeeded,
      ]);
    });

    it('counts each tool call once, however many times it was reported', async () => {
      const { metrics } = setup([
        call('running'),
        call('succeeded'),
        call('running', 'c2'),
        call('succeeded', 'c2'),
        succeeded,
      ]);
      expect(await metrics()).toMatchObject([{ toolCalls: 2 }]);
    });

    it('counts the files the workspace holds at the end: a deleted file is not one', async () => {
      const reads = [[file('a.mjs', '1'), file('b.mjs', '2')], [file('b.mjs', '2')]];
      const { metrics } = setup([call('succeeded'), succeeded], inMemoryWorkspaces({ reads }));
      expect(await metrics()).toMatchObject([{ files: 1 }]);
    });

    it('has no usage when the agent reported none, and still the rest, as after a crash', async () => {
      const { metrics } = setup([call('succeeded'), { throws: new Error('crash') }]);
      expect(await metrics()).toEqual([
        { model: null, durationMs: 750, usage: null, toolCalls: 1, files: 0 },
      ]);
    });

    it('gives no totals for a cancelled run', async () => {
      const { controller, run } = setup([message('one'), 'wait-for-abort']);
      const seen: RunEvent[] = [];
      for await (const event of run('claude-code', task, controller.signal)) {
        seen.push(event);
        controller.abort();
      }
      expect(seen).toEqual([message('one'), cancelled]);
    });
  });

  it('disposes of the workspace when the reader stops listening', async () => {
    const { workspaces, controller, run } = setup([message('one'), message('two'), succeeded]);
    const stream = run('claude-code', task, controller.signal);
    await stream.next();
    await stream.return();
    expect(workspaces.disposed).toEqual(workspaces.created);
  });
});
