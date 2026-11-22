import type { AgentId, RunEvent, RunOutcome, Task, Usage, WorkspaceFile } from '@comparator/domain';

import type { Clock } from '../ports/clock.ts';
import type { CodingAgent } from '../ports/coding-agent.ts';
import type { Workspace, WorkspaceProvider } from '../ports/workspace-provider.ts';
import type { CheckTask } from './check-task.ts';
import type { ReviewRun } from './review-run.ts';

interface StartRunDeps {
  readonly agents: Readonly<Record<AgentId, CodingAgent>>;
  readonly workspaces: WorkspaceProvider;
  readonly clock: Clock;
  /** Whether the agents may run a task. Asked before anything is created. */
  readonly checkTask: CheckTask;
  /** How a run ended when its agent stopped without error: whether it did its task. */
  readonly reviewRun: ReviewRun;
}

/** Runs one agent on a task. Aborting the signal cancels the run. */
export type StartRun = (
  agent: AgentId,
  task: Task,
  signal: AbortSignal,
) => AsyncGenerator<RunEvent, void, void>;

const getErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Follows the files of a workspace: each call reads it and yields the files that changed since the call before,
 * a file that is gone being yielded once as `deleted`.
 *
 * The workspace is the truth about files, not the agent's events: an agent also writes files through shell
 * commands, which report nothing.
 */
function followFiles(workspaces: WorkspaceProvider, workspace: Workspace) {
  const known = new Map<string, WorkspaceFile>();
  return {
    /** The paths of the files the workspace held at the last read. */
    getPaths: () => [...known.values()].filter((file) => file.state !== 'deleted').map((file) => file.path),
    async *readChanges(): AsyncGenerator<RunEvent, void, void> {
      const files = await workspaces.read(workspace);
      const paths = new Set(files.map(({ path }) => path));
      const gone = [...known.keys()]
        .filter((path) => !paths.has(path))
        .map((path): WorkspaceFile => ({ path, content: '', state: 'deleted' }));
      for (const file of [...files, ...gone]) {
        const before = known.get(file.path);
        if (before?.state === file.state && before.content === file.content) continue;
        known.set(file.path, file);
        yield { kind: 'file', file };
      }
    },
  };
}

/**
 * Runs one agent on a task in a fresh workspace and yields what it does, the files it leaves as they change, and
 * the run's totals: what the agent says it consumed, and what the run measures itself (time, tool calls, files).
 *
 * Whatever the agent does, the run ends with exactly one `finished` event, nothing follows it, and the
 * workspace is disposed of. A run that was not cancelled gives its totals just before, also when it failed.
 */
export const startRun = ({ agents, workspaces, clock, checkTask, reviewRun }: StartRunDeps): StartRun =>
  async function* run(agent, task, signal) {
    // A task that is refused starts nothing: no workspace, no agent. The page asks first and shows the refusal
    // once; this is what stops a caller that did not ask.
    const verdict = await checkTask(task, signal);
    if (verdict.verdict === 'refused') {
      yield { kind: 'finished', outcome: { status: 'failed', reason: verdict.reason } };
      return;
    }
    const startedAt = clock.now();
    const created = await workspaces.create();
    if (created.isErr()) {
      yield { kind: 'finished', outcome: { status: 'failed', reason: created.error.reason } };
      return;
    }
    const workspace = created.value;
    const files = followFiles(workspaces, workspace);
    const toolCalls = new Set<string>();
    const said: string[] = [];
    // What the agent reports as it goes: the stream is read once, so these are filled in while it is read.
    let model: string | null = null;
    let usage: Usage | null = null;
    try {
      let outcome: RunOutcome | undefined;
      try {
        for await (const event of agents[agent].run(task, workspace, signal)) {
          if (event.kind === 'finished') {
            outcome = event.outcome;
            break;
          }
          switch (event.kind) {
            case 'model':
              model = event.model;
              break;
            case 'usage':
              usage = event.usage;
              break;
            case 'message':
              said.push(event.text);
              yield event;
              break;
            case 'tool-call':
              toolCalls.add(event.call.id);
              yield event;
              // A tool that ended may have written files.
              if (event.call.status !== 'running') yield* files.readChanges();
              break;
          }
        }
        outcome ??= signal.aborted
          ? { status: 'cancelled' }
          : { status: 'failed', reason: 'The agent stopped without reporting a result.' };
      } catch (error) {
        outcome = signal.aborted
          ? { status: 'cancelled' }
          : { status: 'failed', reason: getErrorMessage(error) };
      }
      // An agent that stopped without error has not always done its task: a reviewer reads what it delivered. The
      // run's time is taken before the review, which is ours and not the agent's.
      let endedAt: number | undefined;
      if (outcome.status === 'succeeded') {
        yield* files.readChanges();
        endedAt = clock.now();
        const work = { task, answer: said.join('\n\n'), files: files.getPaths(), toolCalls: toolCalls.size };
        outcome = await reviewRun(work, signal);
        if (signal.aborted) outcome = { status: 'cancelled' };
      }
      // Nobody follows a cancelled run any more; any other run shows what it left and consumed, also when it failed.
      if (outcome.status !== 'cancelled') {
        yield* files.readChanges();
        const metrics = {
          model,
          durationMs: Math.round((endedAt ?? clock.now()) - startedAt),
          usage,
          toolCalls: toolCalls.size,
          files: files.getPaths().length,
        };
        yield { kind: 'metrics', metrics };
      }
      yield { kind: 'finished', outcome };
    } finally {
      await workspaces.dispose(workspace);
    }
  };
