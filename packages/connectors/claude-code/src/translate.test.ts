import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vite-plus/test';

import { translate } from './translate.ts';

/** A recording of a real run (docs/spike-findings.md). */
function recorded(name: string): SDKMessage[] {
  const path = join(import.meta.dirname, '../../../../fixtures/claude-code', `${name}.json`);
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as { events: { event: SDKMessage }[] };
  return fixture.events.map(({ event }) => event);
}
const replay = (name: string) => recorded(name).flatMap(translate);

describe('Claude Code translator', () => {
  it('turns a successful run into its messages, then one succeeded result', () => {
    const events = replay('success');
    const messages = events.filter((event) => event.kind === 'message');
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.at(-1)?.text).toContain('Node');
    expect(events.at(-1)).toEqual({ kind: 'finished', outcome: { status: 'succeeded' } });
    expect(events.filter((event) => event.kind === 'finished')).toHaveLength(1);
  });

  it('drops everything it does not show yet: tool calls, tool results, thinking, rate-limit notices', () => {
    const native = recorded('edit');
    const events = native.flatMap(translate);
    expect(native.length).toBeGreaterThan(events.length);
    expect(events.every((event) => event.kind === 'message' || event.kind === 'finished')).toBe(true);
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

  it('ignores an event it does not know', () => {
    expect(translate({ type: 'something_new' } as unknown as SDKMessage)).toEqual([]);
  });
});
