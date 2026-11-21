import { describe, expect, it } from 'vite-plus/test';

import type { RunEvent } from '@comparator/domain';

import { ACCESS_REFUSED, present } from './presenter.ts';

async function* failing(reason: string): AsyncGenerator<RunEvent> {
  yield { kind: 'finished', outcome: { status: 'failed', reason } };
}

async function outcomeOf(reason: string) {
  const logged: string[] = [];
  const outcomes = [];
  for await (const chunk of present(failing(reason), (line) => logged.push(line)))
    if (chunk.type === 'data-outcome') outcomes.push(chunk.data);
  return { outcome: outcomes[0], logged };
}

describe('present', () => {
  it("tells a visitor plainly that the app was refused, and keeps the provider's words for the log", async () => {
    const words = 'unexpected status 401 Unauthorized: Incorrect API key provided: sk-proj-****-key.';
    const { outcome, logged } = await outcomeOf(words);
    expect(outcome).toEqual({ status: 'failed', reason: ACCESS_REFUSED });
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain(words);
  });

  it("shows any other failure in the agent's own words, and logs nothing", async () => {
    const { outcome, logged } = await outcomeOf('The agent exited with code 1.');
    expect(outcome).toEqual({ status: 'failed', reason: 'The agent exited with code 1.' });
    expect(logged).toEqual([]);
  });
});
