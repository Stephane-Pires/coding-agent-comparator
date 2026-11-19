import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vite-plus/test';

import type { RunEvent, ToolCall } from '@comparator/domain';

import { createTranslator } from './translate.ts';

/** A recording of a real run (docs/spike-findings.md), and the workspace it ran in. */
function recorded(name: string): { messages: SDKMessage[]; workspace: string } {
  const path = join(import.meta.dirname, '../../../../fixtures/claude-code', `${name}.json`);
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as { events: { event: SDKMessage }[] };
  const messages = fixture.events.map(({ event }) => event);
  const init = messages.find((message) => message.type === 'system' && message.subtype === 'init');
  return { messages, workspace: init && 'cwd' in init ? init.cwd : '/nowhere' };
}
function replay(name: string): RunEvent[] {
  const { messages, workspace } = recorded(name);
  return messages.flatMap(createTranslator(workspace));
}
const callsOf = (events: RunEvent[]): ToolCall[] =>
  events.flatMap((event) => (event.kind === 'tool-call' ? [event.call] : []));
/** The last report of each call: what the page ends up showing. */
const finalCalls = (events: RunEvent[]): ToolCall[] => [
  ...new Map(callsOf(events).map((call) => [call.id, call])).values(),
];

/** A hand-made assistant message that calls one tool. */
const toolUse = (id: string, name: string, input: object) => ({
  type: 'assistant',
  message: { model: 'haiku', content: [{ type: 'tool_use', id, name, input }] },
});

describe('Claude Code translator', () => {
  it('turns a successful run into its messages, then one succeeded result', () => {
    const events = replay('success');
    const messages = events.flatMap((event) => (event.kind === 'message' ? [event.text] : []));
    expect(messages.at(-1)).toContain('Node');
    expect(events.at(-1)).toEqual({ kind: 'finished', outcome: { status: 'succeeded' } });
    expect(events.filter((event) => event.kind === 'finished')).toHaveLength(1);
  });

  it('reports each tool call twice with the same id: running, then ended with everything known', () => {
    const calls = callsOf(replay('success'));
    const command = calls.filter(
      (call) => call.tool.type === 'command' && call.tool.command.includes('hello.mjs'),
    );
    expect(command.map((call) => call.status)).toEqual(['running', 'succeeded']);
    expect(command[0]?.id).toBe(command[1]?.id);
    expect(command[0]?.tool).toEqual(command[1]?.tool);
    expect(command[0]?.output).toBe('');
    expect(command[1]?.output).toContain('Node LTS is 26');
  });

  it('leaves no call running at the end of a run', () => {
    for (const name of ['success', 'edit']) {
      expect(finalCalls(replay(name)).filter((call) => call.status === 'running')).toEqual([]);
    }
  });

  it('gives a web search its query at once, and its sources when it ends', () => {
    const searches = callsOf(replay('success')).filter((call) => call.tool.type === 'web-search');
    const [started, ended] = searches;
    expect(started).toMatchObject({
      status: 'running',
      tool: { type: 'web-search', query: 'current Node.js LTS version 2026', sources: [] },
    });
    expect(ended).toMatchObject({ id: started?.id, status: 'succeeded', output: '' });
    const sources = ended?.tool.type === 'web-search' ? ended.tool.sources : [];
    expect(sources[0]).toEqual({
      title: 'nodejs v26 released',
      url: 'https://www.inmotionhosting.com/support/news/nodejs-v26-released.md',
    });
  });

  it('shows any other tool by its name and what it was pointed at, relative to the workspace', () => {
    const others = finalCalls(replay('edit')).flatMap((call) =>
      call.tool.type === 'other' ? [call.tool] : [],
    );
    expect(others).toContainEqual({ type: 'other', name: 'Read', input: 'math.mjs' });
    expect(others.map((tool) => tool.name)).toContain('Grep');
  });

  it('shows a written file as created, and an edit as modified with its change as a diff', () => {
    const edits = finalCalls(replay('edit')).flatMap((call) =>
      call.tool.type === 'file-edit' ? [{ ...call.tool, status: call.status, output: call.output }] : [],
    );
    expect(edits.map(({ path, change, status, output }) => ({ path, change, status, output }))).toEqual([
      { path: 'math.mjs', change: 'created', status: 'succeeded', output: '' },
      { path: 'math.test.mjs', change: 'created', status: 'succeeded', output: '' },
      { path: 'math.mjs', change: 'modified', status: 'succeeded', output: '' },
      { path: 'math.test.mjs', change: 'modified', status: 'succeeded', output: '' },
    ]);
    expect(edits[0]?.diff).toBe('');
    expect(edits[2]?.diff).toBe(
      [
        '@@ -1,3 +1,3 @@',
        '-export function add(a, b) {',
        '+export function sum(a, b) {',
        '   return a + b;',
        ' }',
      ].join('\n'),
    );
  });

  // No recording has a failed call: Claude Code's `sed` in the edit run exited with 0. This one is hand-made.
  it('marks a tool call whose result is an error', () => {
    const translate = createTranslator('/nowhere');
    const call = {
      type: 'assistant',
      message: {
        model: 'haiku',
        content: [{ type: 'tool_use', id: 'c1', name: 'Bash', input: { command: 'false' } }],
      },
    };
    const result = {
      type: 'user',
      message: {
        content: [{ type: 'tool_result', tool_use_id: 'c1', is_error: true, content: 'Exit code 1' }],
      },
    };
    const events = [call, result].flatMap((message) => translate(message as unknown as SDKMessage));
    expect(callsOf(events).map(({ status, output }) => ({ status, output }))).toEqual([
      { status: 'running', output: '' },
      { status: 'failed', output: 'Exit code 1' },
    ]);
  });

  it('shows a path inside the workspace relative to it, in a command too', () => {
    const translate = createTranslator('/private/tmp/comparator-abc');
    const events = [
      toolUse('c1', 'Bash', { command: 'node /private/tmp/comparator-abc/version.mjs' }),
      toolUse('c2', 'Write', { file_path: '/private/tmp/comparator-abc/src/version.mjs' }),
    ].flatMap((message) => translate(message as unknown as SDKMessage));
    expect(callsOf(events).map((toolCall) => toolCall.tool)).toEqual([
      { type: 'command', command: 'node version.mjs' },
      { type: 'file-edit', path: 'src/version.mjs', change: 'created', diff: '' },
    ]);
  });

  it('hides the calls Claude Code makes to look up its own tools', () => {
    const names = callsOf(replay('success')).flatMap((call) =>
      call.tool.type === 'other' ? [call.tool.name] : [],
    );
    expect(names).not.toContain('ToolSearch');
  });

  it('reads a refused model as a failure, although Claude Code calls the result a success', () => {
    expect(replay('bad-model')).toEqual([
      {
        kind: 'finished',
        outcome: {
          status: 'failed',
          reason:
            "There's an issue with the selected model (no-such-model). It may not exist or you may not have access to it.",
        },
      },
    ]);
  });

  it('reports no result for a cancelled run: the use case ends it', () => {
    expect(replay('abort').some((event) => event.kind === 'finished')).toBe(false);
  });

  it('ignores an event it does not know, and a result with no call', () => {
    const translate = createTranslator('/nowhere');
    expect(translate({ type: 'something_new' } as unknown as SDKMessage)).toEqual([]);
    const orphan = {
      type: 'user',
      message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'unknown', content: 'x' }] },
    };
    expect(translate(orphan as unknown as SDKMessage)).toEqual([]);
  });
});
