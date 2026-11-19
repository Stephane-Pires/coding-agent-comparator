import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ThreadEvent } from '@openai/codex-sdk';
import { describe, expect, it } from 'vite-plus/test';

import { translate } from './translate.ts';

/** A recording of a real run (docs/spike-findings.md). */
function recorded(name: string): ThreadEvent[] {
  const path = join(import.meta.dirname, '../../../../fixtures/codex', `${name}.json`);
  const fixture = JSON.parse(readFileSync(path, 'utf8')) as { events: { event: ThreadEvent }[] };
  return fixture.events.map(({ event }) => event);
}
const replay = (name: string) => recorded(name).flatMap(translate);

describe('Codex translator', () => {
  it('turns a successful run into its messages, then one succeeded result', () => {
    const events = replay('success');
    expect(events.slice(0, -1).map((event) => event.kind)).toEqual(['message', 'message', 'message']);
    expect(events[0]).toEqual({
      kind: 'message',
      text: 'I’ll check the current Node.js release page, write the one-line script, and run it with `node`.',
    });
    expect(events.at(-1)).toEqual({ kind: 'finished', outcome: { status: 'succeeded' } });
  });

  it('drops everything it does not show yet: commands, file changes, web searches', () => {
    const native = recorded('patch');
    const events = native.flatMap(translate);
    expect(native.length).toBeGreaterThan(events.length);
    expect(events.every((event) => event.kind === 'message' || event.kind === 'finished')).toBe(true);
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
    expect(translate({ type: 'something.new' } as unknown as ThreadEvent)).toEqual([]);
  });
});
