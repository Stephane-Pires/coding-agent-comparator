import type { AgentId, RunEvent, RunOutcome, Task, WorkspaceFile } from '@comparator/domain';

import type { CodingAgent } from '../ports/coding-agent.ts';
import type { Workspace, WorkspaceProvider } from '../ports/workspace-provider.ts';

export interface StartRunDeps {
  readonly agents: Readonly<Record<AgentId, CodingAgent>>;
  readonly workspaces: WorkspaceProvider;
}

export interface StartRunInput {
  readonly agent: AgentId;
  readonly task: Task;
  /** Aborting it cancels the run. */
  readonly signal: AbortSignal;
}

export type StartRun = (input: StartRunInput) => AsyncGenerator<RunEvent, void, void>;

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Follows the files of a workspace: each call reads it and yields the files that changed since the call before,
 * a file that is gone being yielded once as `deleted`.
 *
 * The workspace is the truth about files, not the agent's events: an agent also writes files through shell
 * commands, which report nothing.
 */
function fileChanges(workspaces: WorkspaceProvider, workspace: Workspace) {
  const known = new Map<string, WorkspaceFile>();
  return async function* changes(): AsyncGenerator<RunEvent, void, void> {
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
  };
}

/**
 * Runs one agent on a task in a fresh workspace and yields what it does, and the files it leaves as they change.
 *
 * Whatever the agent does, the run ends with exactly one `finished` event, nothing follows it, and the
 * workspace is disposed of.
 */
export const startRun = ({ agents, workspaces }: StartRunDeps): StartRun =>
  async function* run({ agent, task, signal }) {
    const created = await workspaces.create();
    if (created.isErr()) {
      yield { kind: 'finished', outcome: { status: 'failed', reason: created.error.reason } };
      return;
    }
    const workspace = created.value;
    const changes = fileChanges(workspaces, workspace);
    try {
      let outcome: RunOutcome | undefined;
      try {
        for await (const event of agents[agent].run({ task, workspace, signal })) {
          if (event.kind === 'finished') {
            outcome = event.outcome;
            break;
          }
          yield event;
          // A tool that ended may have written files.
          if (event.kind === 'tool-call' && event.call.status !== 'running') yield* changes();
        }
        outcome ??= signal.aborted
          ? { status: 'cancelled' }
          : { status: 'failed', reason: 'The agent stopped without reporting a result.' };
      } catch (error) {
        outcome = signal.aborted ? { status: 'cancelled' } : { status: 'failed', reason: reasonOf(error) };
      }
      // Nobody follows a cancelled run any more; any other run shows the files it left, also when it failed.
      if (outcome.status !== 'cancelled') yield* changes();
      yield { kind: 'finished', outcome };
    } finally {
      await workspaces.dispose(workspace);
    }
  };
