import { errAsync, okAsync } from 'neverthrow';

import type { AgentEvent, RunReview, Task, TaskAssessment, WorkspaceFile } from '@comparator/domain';

import type { Clock } from '../ports/clock.ts';
import type { CodingAgent } from '../ports/coding-agent.ts';
import type { RunReviewer, RunWork } from '../ports/run-reviewer.ts';
import type { TaskClassifier } from '../ports/task-classifier.ts';
import type { Workspace, WorkspaceProvider } from '../ports/workspace-provider.ts';

/** One step of a scripted agent: an event to yield, an error to throw, or a pause until the run is aborted. */
export type Step = AgentEvent | { readonly throws: Error } | 'wait-for-abort';

/** What a scripted agent was given for one run. */
interface GivenRun {
  readonly task: Task;
  readonly workspace: Workspace;
  readonly signal: AbortSignal;
}

const waitForAbort = (signal: AbortSignal) =>
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
export function scriptedAgent(steps: readonly Step[]): CodingAgent & { readonly runs: GivenRun[] } {
  const runs: GivenRun[] = [];
  return {
    runs,
    async *run(task, workspace, signal) {
      runs.push({ task, workspace, signal });
      for (const step of steps) {
        if (step === 'wait-for-abort') {
          await waitForAbort(signal);
          continue;
        }
        if ('throws' in step) throw step.throws;
        yield step;
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

/** A classifier that gives the same answer for every task, or fails with `answer` when it is an error. */
export function scriptedClassifier(
  answer: TaskAssessment | Error,
): TaskClassifier & { readonly asked: Task[] } {
  const asked: Task[] = [];
  return {
    asked,
    assess(task) {
      asked.push(task);
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    },
  };
}

/** A reviewer that gives the same review for every run, or fails with `review` when it is an error. */
export function scriptedReviewer(review: RunReview | Error): RunReviewer & { readonly reviewed: RunWork[] } {
  const reviewed: RunWork[] = [];
  return {
    reviewed,
    review(work) {
      reviewed.push(work);
      return review instanceof Error ? Promise.reject(review) : Promise.resolve(review);
    },
  };
}
