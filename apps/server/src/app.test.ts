import { describe, expect, it } from 'vite-plus/test';

import { startRun } from '@comparator/application';
import { inMemoryWorkspaces, scriptedAgent, tickingClock, type Step } from '@comparator/application/testing';

import { createApp } from './app.ts';

function setup(claudeSteps: readonly Step[], workspaces = inMemoryWorkspaces()) {
  const claude = scriptedAgent(claudeSteps);
  const codex = scriptedAgent([
    { kind: 'message', text: 'from codex' },
    { kind: 'finished', outcome: { status: 'succeeded' } },
  ]);
  const app = createApp({
    startRun: startRun({ agents: { 'claude-code': claude, codex }, workspaces, clock: tickingClock(500) }),
  });
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
      { type: 'data-metrics', data: { durationMs: 500, usage, toolCalls: 0, files: 0 } },
      { type: 'data-outcome', data: { status: 'succeeded' } },
      { type: 'finish' },
    ]);
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
