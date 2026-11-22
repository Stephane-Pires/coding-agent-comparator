import { describe, expect, it } from 'vite-plus/test';

import { Task, type AgentEvent } from '@comparator/domain';

import { overLimits, sandboxRuntime, type CommandLineAgent, type SandboxLike } from './index.ts';

const task = Task.parse('write hello');
/** An agent whose every printed line `{ "say": text }` is a message, and `{ "end": true }` its end. */
const cli: CommandLineAgent = {
  command: (asked) => ({ cmd: 'agent', args: ['--task', asked], env: { AGENT_KEY: 'a-key' } }),
  start: () => ({
    first: [{ kind: 'model', model: 'a-model' }],
    translate: (line): AgentEvent[] => {
      if (typeof line !== 'object' || line === null) return [];
      if ('say' in line) return [{ kind: 'message', text: String(line.say) }];
      return 'end' in line ? [{ kind: 'finished', outcome: { status: 'succeeded' } }] : [];
    },
  }),
};

/** A stand-in for a sandbox: it prints `chunks` as an agent would, and remembers what it was asked. */
function fakeSandbox(chunks: readonly string[], { exitCode = 0, stderr = '', listing = '[]' } = {}) {
  const started: { cmd: string; args: string[]; cwd: string; env: Record<string, string> }[] = [];
  const state = { stopped: false, simple: [] as string[] };
  const sandbox = {
    runCommand(first: unknown, args?: string[]) {
      if (typeof first === 'string') {
        state.simple.push([first, ...(args ?? [])].join(' ').slice(0, 30));
        return Promise.resolve({ stdout: () => Promise.resolve(listing) });
      }
      started.push(first as (typeof started)[number]);
      return Promise.resolve({
        async *logs() {
          for (const data of chunks) yield { stream: 'stdout' as const, data };
          if (stderr) yield { stream: 'stderr' as const, data: stderr };
        },
        wait: () => Promise.resolve({ exitCode }),
      });
    },
    stop() {
      state.stopped = true;
      return Promise.resolve();
    },
  } as unknown as SandboxLike;
  return { sandbox, started, state };
}

const NO_LIMITS = { atOnce: 100, perHour: 100 };
const none = () => Promise.resolve([]);

async function run(fake: ReturnType<typeof fakeSandbox>) {
  const { agents, workspaces } = sandboxRuntime(
    { 'claude-code': cli, codex: cli },
    {
      runLimitMs: 60_000,
      limits: NO_LIMITS,
      createSandbox: () => Promise.resolve(fake.sandbox),
      recentSandboxes: none,
    },
  );
  const workspace = (await workspaces.create())._unsafeUnwrap();
  const signal = new AbortController().signal;
  return { workspaces, workspace, events: agents['claude-code'].run(task, workspace, signal) };
}

describe('sandboxRuntime', () => {
  it('starts the agent by its command in the workspace of the sandbox, with only its own environment', async () => {
    const fake = fakeSandbox(['{"end":true}\n']);
    const { workspace, events } = await run(fake);
    await Array.fromAsync(events);
    expect(fake.started).toMatchObject([
      { cmd: 'agent', args: ['--task', 'write hello'], cwd: workspace.path, env: { AGENT_KEY: 'a-key' } },
    ]);
  });

  it('reads the events line by line, whatever the pieces the output arrives in', async () => {
    const fake = fakeSandbox(['{"say":"on', 'e"}\n{"say":"two"}\nnot json\n', '{"end":true}']);
    const { events } = await run(fake);
    expect(await Array.fromAsync(events)).toEqual([
      { kind: 'model', model: 'a-model' },
      { kind: 'message', text: 'one' },
      { kind: 'message', text: 'two' },
      { kind: 'finished', outcome: { status: 'succeeded' } },
    ]);
  });

  it('fails with what the agent wrote on its error output when it exits without ending its run', async () => {
    const fake = fakeSandbox(['{"say":"one"}\n'], { exitCode: 1, stderr: 'no such model' });
    const { events } = await run(fake);
    await expect(Array.fromAsync(events)).rejects.toThrow('no such model');
  });

  it('lists the files of the workspace, a binary one without its content', async () => {
    const listing = JSON.stringify([
      { path: 'src/hello.mjs', content: Buffer.from('console.log("hi");\n').toString('base64') },
      { path: 'logo.png', content: Buffer.from([137, 80, 0, 71]).toString('base64') },
    ]);
    const { workspaces, workspace } = await run(fakeSandbox([], { listing }));
    expect(await workspaces.read(workspace)).toEqual([
      { path: 'logo.png', content: '', state: 'binary' },
      { path: 'src/hello.mjs', content: 'console.log("hi");\n', state: 'complete' },
    ]);
  });

  it('stops the sandbox when the workspace is disposed of', async () => {
    const fake = fakeSandbox([]);
    const { workspaces, workspace } = await run(fake);
    await workspaces.dispose(workspace);
    expect(fake.state.stopped).toBe(true);
  });

  it('says so when a sandbox cannot be created', async () => {
    const { workspaces } = sandboxRuntime(
      { 'claude-code': cli, codex: cli },
      {
        runLimitMs: 60_000,
        limits: NO_LIMITS,
        createSandbox: () => Promise.reject(new Error('no token')),
        recentSandboxes: none,
      },
    );
    expect((await workspaces.create())._unsafeUnwrapErr()).toEqual({
      kind: 'workspace-unavailable',
      reason: 'Could not create a sandbox: no token',
    });
  });
});

describe('the usage limits', () => {
  const NOW = 10 * 60 * 60 * 1000;
  const LIMITS = { atOnce: 2, perHour: 3 };
  const minutesAgo = (minutes: number, status = 'stopped') => ({ createdAt: NOW - minutes * 60_000, status });

  it('lets a run start below both limits', () => {
    expect(overLimits([minutesAgo(1, 'running'), minutesAgo(5)], LIMITS, NOW)).toBeUndefined();
  });

  it('refuses a run when as many are already running as allowed at once', () => {
    const refusal = overLimits([minutesAgo(1, 'running'), minutesAgo(2, 'pending')], LIMITS, NOW);
    expect(refusal).toContain('already running 2 runs');
  });

  it('refuses a run over the hour, and says when a place frees up', () => {
    const refusal = overLimits([minutesAgo(5), minutesAgo(20), minutesAgo(48)], LIMITS, NOW);
    expect(refusal).toContain('limit of 3 runs an hour');
    expect(refusal).toContain('in 12 minutes');
  });

  it('counts only the runs of the last hour', () => {
    expect(overLimits([minutesAgo(5), minutesAgo(20), minutesAgo(61)], LIMITS, NOW)).toBeUndefined();
  });

  it('refuses before any sandbox is created, with the reason', async () => {
    let created = 0;
    const { workspaces } = sandboxRuntime(
      { 'claude-code': cli, codex: cli },
      {
        runLimitMs: 60_000,
        limits: { atOnce: 1, perHour: 10 },
        createSandbox: () => {
          created += 1;
          return Promise.reject(new Error('not expected'));
        },
        recentSandboxes: () => Promise.resolve([{ createdAt: Date.now(), status: 'running' }]),
      },
    );
    const error = (await workspaces.create())._unsafeUnwrapErr();
    expect(error.reason).toContain('already running 1 runs');
    expect(created).toBe(0);
  });

  it('lets the run go ahead when the limits cannot be read', async () => {
    const fake = fakeSandbox([]);
    const { workspaces } = sandboxRuntime(
      { 'claude-code': cli, codex: cli },
      {
        runLimitMs: 60_000,
        limits: { atOnce: 1, perHour: 1 },
        createSandbox: () => Promise.resolve(fake.sandbox),
        recentSandboxes: () => Promise.reject(new Error('Vercel did not answer')),
      },
    );
    expect((await workspaces.create()).isOk()).toBe(true);
  });
});
