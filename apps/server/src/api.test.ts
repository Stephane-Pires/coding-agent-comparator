import { describe, expect, it } from 'vite-plus/test';

import { startRun, type CheckTask, type ReviewRun } from '@comparator/application';
import { inMemoryWorkspaces, scriptedAgent, tickingClock, type Step } from '@comparator/application/testing';

import { createApp } from './api.ts';

const accepts: CheckTask = () => Promise.resolve({ verdict: 'accepted' });
const done: ReviewRun = () => Promise.resolve({ status: 'succeeded' });
const asksBack: ReviewRun = () => Promise.resolve({ status: 'incomplete', reason: 'It asked a question.' });
const refuses: CheckTask = () => Promise.resolve({ verdict: 'refused', reason: 'Not a coding task.' });

function setup(
  claudeSteps: readonly Step[],
  workspaces = inMemoryWorkspaces(),
  checkTask = accepts,
  reviewRun = done,
  password?: string,
) {
  const claude = scriptedAgent(claudeSteps);
  const codex = scriptedAgent([
    { kind: 'message', text: 'from codex' },
    { kind: 'finished', outcome: { status: 'succeeded' } },
  ]);
  const app = createApp(
    {
      checkTask,
      startRun: startRun({
        agents: { 'claude-code': claude, codex },
        workspaces,
        clock: tickingClock(500),
        checkTask,
        reviewRun,
      }),
    },
    { password, https: true },
  );
  const post = (path: string, body: unknown, signal?: AbortSignal) =>
    app.request(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
  return { app, post, claude, workspaces };
}

/** The `data:` payloads of a server-sent event stream. */
async function allChunks(response: Response): Promise<{ type: string }[]> {
  const text = await response.text();
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice('data: '.length)) as { type: string } | null)
    .filter((chunk) => chunk !== null && typeof chunk === 'object' && 'type' in chunk);
}
/** The same without the run's totals, which have their own test. */
const chunks = async (response: Response) =>
  (await allChunks(response)).filter((chunk) => chunk.type !== 'data-metrics');

describe('POST /api/tasks/check', () => {
  it('answers with the verdict of the check', async () => {
    const accepted = await setup([]).post('/api/tasks/check', { task: 'write a script' });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual({ verdict: 'accepted' });
    const refused = await setup([], inMemoryWorkspaces(), refuses).post('/api/tasks/check', {
      task: 'a poem',
    });
    expect(await refused.json()).toEqual({ verdict: 'refused', reason: 'Not a coding task.' });
  });

  it('refuses an empty task before any check, naming the field', async () => {
    const response = await setup([]).post('/api/tasks/check', { task: '   ' });
    expect(response.status).toBe(400);
    expect(JSON.stringify(await response.json())).toContain('task');
  });

  it('a run of a refused task ends at once with the reason, and starts no agent', async () => {
    const { post, claude } = setup([{ kind: 'message', text: 'hi' }], inMemoryWorkspaces(), refuses);
    const response = await post('/api/runs', { agent: 'claude-code', task: 'a poem' });
    expect(await chunks(response)).toEqual([
      { type: 'start' },
      { type: 'data-outcome', data: { status: 'failed', reason: 'Not a coding task.' } },
      { type: 'finish' },
    ]);
    expect(claude.runs).toHaveLength(0);
  });
});

describe('POST /api/runs', () => {
  it('streams the run of the chosen agent as server-sent events', async () => {
    const { post, claude, workspaces } = setup([
      { kind: 'message', text: 'Working on it.' },
      { kind: 'message', text: 'Done.' },
      { kind: 'finished', outcome: { status: 'succeeded' } },
    ]);
    const response = await post('/api/runs', { agent: 'claude-code', task: '  say hi  ' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    // Without it, a compressing proxy holds the events back until the run is over.
    expect(response.headers.get('cache-control')).toContain('no-transform');
    expect(await chunks(response)).toEqual([
      { type: 'start' },
      { type: 'text-start', id: 'message-1' },
      { type: 'text-delta', id: 'message-1', delta: 'Working on it.' },
      { type: 'text-end', id: 'message-1' },
      { type: 'text-start', id: 'message-2' },
      { type: 'text-delta', id: 'message-2', delta: 'Done.' },
      { type: 'text-end', id: 'message-2' },
      { type: 'data-outcome', data: { status: 'succeeded' } },
      { type: 'finish' },
    ]);
    expect(claude.runs[0]?.task).toBe('say hi');
    expect(workspaces.disposed).toEqual(workspaces.created);
  });

  it("streams a tool call as a data part with the call's id, once running and once ended", async () => {
    const tool = { type: 'command', command: 'node hello.mjs' } as const;
    const { post } = setup([
      { kind: 'tool-call', call: { id: 'call-1', tool, status: 'running', output: '' } },
      { kind: 'tool-call', call: { id: 'call-1', tool, status: 'succeeded', output: 'hi\n' } },
      { kind: 'finished', outcome: { status: 'succeeded' } },
    ]);
    const response = await post('/api/runs', { agent: 'claude-code', task: 'say hi' });
    expect(await chunks(response)).toEqual([
      { type: 'start' },
      { type: 'data-tool-call', id: 'call-1', data: { id: 'call-1', tool, status: 'running', output: '' } },
      {
        type: 'data-tool-call',
        id: 'call-1',
        data: { id: 'call-1', tool, status: 'succeeded', output: 'hi\n' },
      },
      { type: 'data-outcome', data: { status: 'succeeded' } },
      { type: 'finish' },
    ]);
  });

  it('streams each file the run left as a data part with its path, before the outcome', async () => {
    const file = { path: 'src/hello.mjs', content: 'console.log(1);\n', state: 'complete' } as const;
    const { post } = setup(
      [{ kind: 'finished', outcome: { status: 'succeeded' } }],
      inMemoryWorkspaces({ reads: [[file]] }),
    );
    const response = await post('/api/runs', { agent: 'claude-code', task: 'say hi' });
    expect(await chunks(response)).toEqual([
      { type: 'start' },
      { type: 'data-file', id: 'src/hello.mjs', data: file },
      { type: 'data-outcome', data: { status: 'succeeded' } },
      { type: 'finish' },
    ]);
  });

  it('streams the totals of the run as a data part, before the outcome', async () => {
    const usage = { inputTokens: 1200, cachedInputTokens: 800, outputTokens: 90, costUsd: null };
    const { post } = setup([
      { kind: 'usage', usage },
      { kind: 'finished', outcome: { status: 'succeeded' } },
    ]);
    const response = await post('/api/runs', { agent: 'claude-code', task: 'say hi' });
    expect(await allChunks(response)).toEqual([
      { type: 'start' },
      { type: 'data-metrics', data: { model: null, durationMs: 500, usage, toolCalls: 0, files: 0 } },
      { type: 'data-outcome', data: { status: 'succeeded' } },
      { type: 'finish' },
    ]);
  });

  it('streams an incomplete run as its outcome, with the reason', async () => {
    const { post } = setup(
      [{ kind: 'finished', outcome: { status: 'succeeded' } }],
      inMemoryWorkspaces(),
      accepts,
      asksBack,
    );
    const response = await post('/api/runs', { agent: 'claude-code', task: 'write a function' });
    expect((await chunks(response)).at(-2)).toEqual({
      type: 'data-outcome',
      data: { status: 'incomplete', reason: 'It asked a question.' },
    });
  });

  it('streams a failure as the outcome of the run, not as an HTTP error', async () => {
    const { post } = setup([{ throws: new Error('process crashed') }]);
    const response = await post('/api/runs', { agent: 'claude-code', task: 'say hi' });
    expect(response.status).toBe(200);
    expect(await chunks(response)).toEqual([
      { type: 'start' },
      { type: 'data-outcome', data: { status: 'failed', reason: 'process crashed' } },
      { type: 'finish' },
    ]);
  });

  it.each([
    ['an unknown agent', { agent: 'gemini', task: 'say hi' }],
    ['an empty task', { agent: 'codex', task: '   ' }],
    ['a missing task', { agent: 'codex' }],
  ])('answers 400 to %s, and starts nothing', async (_label, body) => {
    const { post, workspaces } = setup([]);
    const response = await post('/api/runs', body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'BAD_REQUEST' });
    expect(workspaces.created).toEqual([]);
  });
});

describe('POST /rpc/runs/start', () => {
  it('serves the same run to the typed client', async () => {
    const { post } = setup([{ kind: 'finished', outcome: { status: 'cancelled' } }]);
    const response = await post('/rpc/runs/start', { json: { agent: 'claude-code', task: 'say hi' } });
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"status":"cancelled"');
  });
});

describe('the API reference', () => {
  it('describes the run procedure, its input and its stream', async () => {
    const { app } = setup([]);
    const document = (await (await app.request('/openapi.json')).json()) as {
      paths: Record<string, { post: { requestBody: unknown; responses: Record<string, unknown> } }>;
    };
    const operation = document.paths['/runs']!.post;
    expect(JSON.stringify(operation.requestBody)).toContain('claude-code');
    expect(JSON.stringify(operation.responses)).toContain('text/event-stream');
    expect(JSON.stringify(operation.responses)).toContain('data-outcome');
    expect(operation.responses).toHaveProperty('400');
  });

  it('serves Scalar at /docs', async () => {
    const { app } = setup([]);
    const response = await app.request('/docs');
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('/openapi.json');
  });
});

describe('a private API', () => {
  const PASSWORD = 'open sesame';
  const { app } = setup([], inMemoryWorkspaces(), accepts, done, PASSWORD);
  const call = (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) =>
    app.request(path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const check = (headers: Record<string, string>) =>
    call('POST', '/api/tasks/check', headers, { task: 'write a script' });

  it('refuses to check a task or start a run without the password, on both routes', async () => {
    expect((await check({})).status).toBe(401);
    expect((await check({ authorization: 'Bearer not the password' })).status).toBe(401);
    expect((await check({ cookie: 'comparator-pass=made-up' })).status).toBe(401);
    const run = await call('POST', '/api/runs', {}, { agent: 'codex', task: 'write a script' });
    expect(run.status).toBe(401);
    const rpc = await call('POST', '/rpc/tasks/check', {}, { json: { task: 'write a script' } });
    expect(rpc.status).toBe(401);
  });

  it('says to anyone whether they are allowed', async () => {
    expect(await (await call('GET', '/api/access')).json()).toEqual({ allowed: false });
  });

  it('a wrong password gives nothing', async () => {
    const wrong = await call('POST', '/api/access', {}, { password: 'open sesame ' });
    expect(await wrong.json()).toEqual({ allowed: false });
    expect(wrong.headers.get('set-cookie')).toBeNull();
  });

  it('the right password gives a pass, which then opens the API', async () => {
    const entered = await call('POST', '/api/access', {}, { password: PASSWORD });
    expect(await entered.json()).toEqual({ allowed: true });
    const cookie = entered.headers.get('set-cookie') ?? '';
    // No script can read it, another site cannot use it, it is never sent in clear, and it does not hold the password.
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).not.toContain(PASSWORD);
    const pass = cookie.split(';')[0] ?? '';
    expect(await (await call('GET', '/api/access', { cookie: pass })).json()).toEqual({ allowed: true });
    expect((await check({ cookie: pass })).status).toBe(200);
  });

  it('a program may send the password with each call instead', async () => {
    expect((await check({ authorization: `Bearer ${PASSWORD}` })).status).toBe(200);
  });

  it('leaves the reference open, and gives it a field for the password', async () => {
    expect((await call('GET', '/docs')).status).toBe(200);
    const document = (await (await call('GET', '/openapi.json')).json()) as { security?: unknown };
    expect(document.security).toEqual([{ password: [] }]);
  });
});

describe('an API with no password, as on a dev machine', () => {
  it('allows everyone, and sets no cookie', async () => {
    const { app, post } = setup([]);
    expect(await (await app.request('/api/access')).json()).toEqual({ allowed: true });
    const entered = await post('/api/access', { password: 'anything' });
    expect(await entered.json()).toEqual({ allowed: true });
    expect(entered.headers.get('set-cookie')).toBeNull();
  });
});
