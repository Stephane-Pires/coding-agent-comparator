import { errAsync, okAsync } from 'neverthrow';

import type { AgentEvent, WorkspaceFile } from '@comparator/domain';

import type { Clock } from '../ports/clock.ts';
import type { AgentRun, CodingAgent } from '../ports/coding-agent.ts';
import type { Workspace, WorkspaceProvider } from '../ports/workspace-provider.ts';

/** One step of a scripted agent: an event to yield, an error to throw, or a pause until the run is aborted. */
export type Step = AgentEvent | { readonly throws: Error } | 'wait-for-abort';

const aborted = (signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) resolve();
    else signal.addEventListener('abort', () => resolve(), { once: true });
  });

/** A clock that moves forward by `tickMs` each time it is read. */
export function tickingClock(tickMs: number): Clock {
  let time = 0;
  return { now: () => (time += tickMs) };
}

/** An agent that replays `steps`, and records the runs it was given. */
export function scriptedAgent(steps: readonly Step[]): CodingAgent & { readonly runs: AgentRun[] } {
  const runs: AgentRun[] = [];
  return {
    runs,
    async *run(run) {
      runs.push(run);
      for (const step of steps) {
        if (step === 'wait-for-abort') await aborted(run.signal);
        else if ('throws' in step) throw step.throws;
        else yield step;
      }
    },
  };
}

/**
 * Workspaces that exist only as names, and remember whether they were disposed of. Each read gives the next entry
 * of `reads`, then the last one again; with no `reads`, a workspace stays empty.
 */
export function inMemoryWorkspaces(
  options: { readonly failWith?: string; readonly reads?: readonly (readonly WorkspaceFile[])[] } = {},
): WorkspaceProvider & {
  readonly created: Workspace[];
  readonly disposed: Workspace[];
} {
  const created: Workspace[] = [];
  const disposed: Workspace[] = [];
  let reads = 0;
  return {
    created,
    disposed,
    create() {
      if (options.failWith !== undefined)
        return errAsync({ kind: 'workspace-unavailable', reason: options.failWith });
      const workspace = { path: `/workspaces/${created.length + 1}` };
      created.push(workspace);
      return okAsync(workspace);
    },
    read() {
      const { reads: script = [] } = options;
      return Promise.resolve(script[Math.min(reads++, script.length - 1)] ?? []);
    },
    dispose(workspace) {
      disposed.push(workspace);
      return Promise.resolve();
    },
  };
}
