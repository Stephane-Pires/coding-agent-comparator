import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ThreadEvent } from '@openai/codex-sdk';
import { describe, expect, it } from 'vite-plus/test';

import type { AgentEvent, ToolCall } from '@comparator/domain';

import { translate, unwrapCommand } from './translate.ts';

const WORKSPACE = '/workspace';
/** A recording of a real run, its temporary folder renamed to `WORKSPACE`. */
function recorded(name: string): ThreadEvent[] {
  const path = join(import.meta.dirname, '../../../../fixtures/codex', `${name}.json`);
  const json = readFileSync(path, 'utf8').replaceAll(/\/tmp\/spike-codex-\w+/g, WORKSPACE);
  const fixture = JSON.parse(json) as { events: { event: ThreadEvent }[] };
  return fixture.events.map(({ event }) => event);
}
const replay = (name: string) => recorded(name).flatMap((event) => translate(event, WORKSPACE));
const callsOf = (events: AgentEvent[]): ToolCall[] =>
  events.flatMap((event) => (event.kind === 'tool-call' ? [event.call] : []));
/** The last report of each call: what the page ends up showing. */
const finalCalls = (events: AgentEvent[]): ToolCall[] => [
  ...new Map(callsOf(events).map((call) => [call.id, call])).values(),
];

describe('Codex translator', () => {
  it('turns a successful run into its messages, then one succeeded result', () => {
    const events = replay('success');
    const messages = events.flatMap((event) => (event.kind === 'message' ? [event.text] : []));
    expect(messages).toHaveLength(3);
    expect(messages[0]).toBe(
      'I’ll check the current Node.js release page, write the one-line script, and run it with `node`.',
    );
    expect(events.at(-1)).toEqual({ kind: 'finished', outcome: { status: 'succeeded' } });
  });

  it('reports a command twice with the same id: running, then ended with its output', () => {
    const [started, ended] = callsOf(replay('success')).filter((call) => call.tool.type === 'command');
    expect(started).toMatchObject({ status: 'running', output: '' });
    expect(ended).toMatchObject({ id: started?.id, status: 'succeeded', output: 'Node LTS is 26\n' });
    expect(ended?.tool).toEqual(started?.tool);
  });

  it('shows the command the agent meant, without the shell Codex wraps it in', () => {
    const command = finalCalls(replay('success')).find((call) => call.tool.type === 'command');
    expect(command?.tool).toEqual({
      type: 'command',
      command: `cat > hello.mjs <<'EOF'\nconsole.log("Node LTS is 26");\nEOF\nnode hello.mjs`,
    });
  });

  it.each([
    [`/bin/zsh -lc "echo \\"hi\\" && pwd"`, `echo "hi" && pwd`],
    [`/bin/bash -lc 'echo '\\''hi'\\'''`, `echo 'hi'`],
    [`bash -lc "ls"`, `ls`],
    [`node hello.mjs`, `node hello.mjs`],
  ])('unwraps %s', (commandLine, command) => {
    expect(unwrapCommand(commandLine)).toBe(command);
  });

  it('lets the end of a web search replace its start, which has no query yet', () => {
    const [started, ended] = callsOf(replay('success')).filter((call) => call.tool.type === 'web-search');
    expect(started).toMatchObject({
      status: 'running',
      tool: { type: 'web-search', query: '', sources: [] },
    });
    expect(ended).toMatchObject({ id: started?.id, status: 'succeeded' });
    const tool = ended?.tool.type === 'web-search' ? ended.tool : undefined;
    expect(tool?.query).toContain('Node.js LTS');
    expect(tool?.sources[0]).toEqual({
      title: 'Node.js — Node.js Releases',
      url: 'https://nodejs.org/en/about/previous-releases',
    });
  });

  it('marks a command that failed, and leaves no call running at the end of a run', () => {
    const calls = finalCalls(replay('edit'));
    expect(calls.some((call) => call.status === 'failed')).toBe(true);
    expect(calls.filter((call) => call.status === 'running')).toEqual([]);
  });

  it('shows a file change by its path in the workspace: created, then modified', () => {
    const edits = finalCalls(replay('patch')).filter((call) => call.tool.type === 'file-edit');
    expect(edits.map(({ tool, status }) => ({ tool, status }))).toEqual([
      { tool: { type: 'file-edit', path: 'note.txt', change: 'created', diff: '' }, status: 'succeeded' },
      { tool: { type: 'file-edit', path: 'note.txt', change: 'modified', diff: '' }, status: 'succeeded' },
    ]);
    expect(callsOf(replay('patch')).filter((call) => call.tool.type === 'file-edit')).toHaveLength(4);
  });

  it('names a file where Codex links to it in the temporary workspace, and keeps a link to the web', () => {
    const messages = replay('success').flatMap((event) => (event.kind === 'message' ? [event.text] : []));
    expect(messages.at(-1)).toBe(
      'Created and ran `hello.mjs`. It printed `Node LTS is 26`. The [official Node.js releases page](https://nodejs.org/en/about/previous-releases) lists v26 as LTS.',
    );
  });

  it('reports what the run consumed just before its end, with no cost: Codex gives none', () => {
    expect(replay('success').at(-2)).toEqual({
      kind: 'usage',
      // Recorded: 56,186 input tokens, 48,000 of them cached.
      usage: { inputTokens: 56_186, cachedInputTokens: 48_000, outputTokens: 277, costUsd: null },
    });
  });

  it('reports a refused model once, although Codex announces it twice', () => {
    expect(replay('bad-model')).toEqual([
      {
        kind: 'finished',
        outcome: {
          status: 'failed',
          reason: "The 'no-such-model' model is not supported when using Codex with a ChatGPT account.",
        },
      },
    ]);
  });

  it('reports no result for a cancelled run: the use case ends it', () => {
    expect(replay('abort').some((event) => event.kind === 'finished')).toBe(false);
  });

  it('ignores an event it does not know', () => {
    expect(translate({ type: 'something.new' } as unknown as ThreadEvent, WORKSPACE)).toEqual([]);
  });
});
