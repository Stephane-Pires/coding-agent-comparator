import { okAsync } from 'neverthrow';
import { z } from 'zod';

import type { CodingAgent, RunReviewer, TaskClassifier, WorkspaceProvider } from '@comparator/application';
import { AgentId, RunEvent, TaskVerdict, type AgentEvent, type WorkspaceFile } from '@comparator/domain';

export interface RecordedRuntime {
  readonly agents: Readonly<Record<AgentId, CodingAgent>>;
  readonly workspaces: WorkspaceProvider;
  readonly classifier: TaskClassifier;
  readonly reviewer: RunReviewer;
}

/**
 * One task as it really went: what the task check said, and for each agent the events of its run, as `startRun`
 * yielded them. Made by `pnpm fixtures:record`, from real runs.
 */
export const Recording = z.object({
  task: z.string(),
  verdict: TaskVerdict,
  /** Empty when the task was refused: no agent ran. */
  runs: z.partialRecord(AgentId, z.array(RunEvent)),
});
export type Recording = z.infer<typeof Recording>;

/** What an agent said in a run, as the run hands it to a reviewer: its messages, in order. */
const getAnswer = (events: readonly RunEvent[]): string =>
  events.flatMap((event) => (event.kind === 'message' ? [event.text] : [])).join('\n\n');

/** Waits `ms`, or less if the run is aborted. */
const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });

/**
 * Stands in for the real agents, their workspaces and the two questions asked to a model, by replaying recordings.
 * Everything above the ports runs for real: the use cases, the API, the stream and the page.
 *
 * A task is answered with its own recording; any other task gets the first recording that was accepted, so the app
 * always has something to show. Events are `paceMs` apart, so a run is seen arriving.
 */
export function createRecordedRuntime(recordings: readonly Recording[], paceMs: number): RecordedRuntime {
  const findRecording = (task: string) => recordings.find((recording) => recording.task === task);
  const findPlayedRecording = (task: string) =>
    findRecording(task) ?? recordings.find((recording) => recording.verdict.verdict === 'accepted');
  // The files of each open workspace, by path: what a recorded agent "wrote" so far.
  const open = new Map<string, Map<string, WorkspaceFile>>();
  let created = 0;

  const createAgent = (id: AgentId): CodingAgent => ({
    async *run(task, workspace, signal): AsyncGenerator<AgentEvent, void, void> {
      const events = findPlayedRecording(task)?.runs[id] ?? [];
      const files = open.get(workspace.path);
      const metrics = events.flatMap((event) => (event.kind === 'metrics' ? [event.metrics] : [])).at(0);
      if (metrics?.model) yield { kind: 'model', model: metrics.model };
      for (const [index, event] of events.entries()) {
        if (signal.aborted) return;
        // A run observes these itself: the files by reading the workspace, the totals by counting.
        if (event.kind === 'file' || event.kind === 'metrics') continue;
        // The files recorded right after this event are in the workspace before the run looks for them.
        for (const next of events.slice(index + 1)) {
          if (next.kind !== 'file') break;
          files?.set(next.file.path, next.file);
        }
        if (event.kind !== 'finished') {
          await wait(paceMs, signal);
          yield event;
          continue;
        }
        if (metrics?.usage) yield { kind: 'usage', usage: metrics.usage };
        // An incomplete run is one whose agent stopped cleanly: the reviewer below is what calls it incomplete.
        const { outcome } = event;
        yield {
          kind: 'finished',
          outcome: outcome.status === 'incomplete' ? { status: 'succeeded' } : outcome,
        };
        return;
      }
    },
  });

  return {
    agents: { 'claude-code': createAgent('claude-code'), codex: createAgent('codex') },
    workspaces: {
      create() {
        const path = `recorded-${++created}`;
        open.set(path, new Map());
        return okAsync({ path });
      },
      read: (workspace) =>
        Promise.resolve(
          [...(open.get(workspace.path)?.values() ?? [])].filter((file) => file.state !== 'deleted'),
        ),
      dispose(workspace) {
        open.delete(workspace.path);
        return Promise.resolve();
      },
    },
    classifier: {
      assess(task) {
        const verdict = findRecording(task)?.verdict;
        return Promise.resolve(
          verdict?.verdict === 'refused'
            ? { reason: verdict.reason, isCodingTask: false, hasFileResult: false }
            : { reason: 'A recorded task.', isCodingTask: true, hasFileResult: true },
        );
      },
    },
    reviewer: {
      // A reviewer is not told which agent it reads: the run is found by what the agent said.
      review({ task, answer }) {
        const run = Object.values(findPlayedRecording(task)?.runs ?? {}).find(
          (events) => getAnswer(events) === answer,
        );
        const outcome = run?.flatMap((event) => (event.kind === 'finished' ? [event.outcome] : [])).at(0);
        return Promise.resolve(
          outcome?.status === 'incomplete'
            ? { reason: outcome.reason, isTaskDone: false }
            : { reason: 'Recorded as done.', isTaskDone: true },
        );
      },
    },
  };
}
