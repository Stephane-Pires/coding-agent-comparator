import { describe, expect, it } from 'vite-plus/test';

import { Task, type RunEvent, type WorkspaceFile } from '@comparator/domain';

import { inMemoryWorkspaces, scriptedAgent, type Step } from '../testing/index.ts';
import { startRun } from './start-run.ts';

const task = Task.parse('write a script');
const message = (text: string): RunEvent => ({ kind: 'message', text });
const succeeded: RunEvent = { kind: 'finished', outcome: { status: 'succeeded' } };
const cancelled: RunEvent = { kind: 'finished', outcome: { status: 'cancelled' } };
const failed = (reason: string): RunEvent => ({ kind: 'finished', outcome: { status: 'failed', reason } });
const file = (path: string, content: string): WorkspaceFile => ({ path, content, state: 'complete' });
const changed = (f: WorkspaceFile): RunEvent => ({ kind: 'file', file: f });
const call = (status: 'running' | 'succeeded'): RunEvent => ({
  kind: 'tool-call',
  call: { id: 'c1', tool: { type: 'command', command: 'node write.mjs' }, status, output: '' },
});

function setup(steps: readonly Step[], workspaces = inMemoryWorkspaces()) {
  const claude = scriptedAgent(steps);
  const codex = scriptedAgent([message('from codex'), succeeded]);
  const controller = new AbortController();
  const run = startRun({ agents: { 'claude-code': claude, codex }, workspaces });
  const events = () => Array.fromAsync(run({ agent: 'claude-code', task, signal: controller.signal }));
  return { claude, codex, workspaces, controller, run, events };
}

describe('startRun', () => {
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
    for await (const event of run({ agent: 'claude-code', task, signal: controller.signal })) {
      seen.push(event);
      controller.abort();
    }
    expect(seen).toEqual([message('one'), cancelled]);
  });

  it('ends as cancelled when the run is aborted and the agent just stops', async () => {
    const { controller, run } = setup([message('one'), 'wait-for-abort']);
    const seen: RunEvent[] = [];
    for await (const event of run({ agent: 'claude-code', task, signal: controller.signal })) {
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
      for await (const event of run({ agent: 'claude-code', task, signal: controller.signal })) {
        seen.push(event);
        controller.abort();
      }
      expect(seen).toEqual([message('one'), cancelled]);
    });
  });

  it('disposes of the workspace when the reader stops listening', async () => {
    const { workspaces, controller, run } = setup([message('one'), message('two'), succeeded]);
    const stream = run({ agent: 'claude-code', task, signal: controller.signal });
    await stream.next();
    await stream.return();
    expect(workspaces.disposed).toEqual(workspaces.created);
  });
});
