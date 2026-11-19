import type { AgentId, RunEvent, RunOutcome, Task } from '@comparator/domain';

import type { CodingAgent } from '../ports/coding-agent.ts';
import type { WorkspaceProvider } from '../ports/workspace-provider.ts';

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

const finished = (outcome: RunOutcome): RunEvent => ({ kind: 'finished', outcome });

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * Runs one agent on a task in a fresh workspace and yields what it does.
 *
 * Whatever the agent does, the run ends with exactly one `finished` event, nothing follows it, and the
 * workspace is disposed of.
 */
export const startRun = ({ agents, workspaces }: StartRunDeps): StartRun =>
  async function* run({ agent, task, signal }) {
    const created = await workspaces.create();
    if (created.isErr()) {
      yield finished({ status: 'failed', reason: created.error.reason });
      return;
    }
    const workspace = created.value;
    try {
      for await (const event of agents[agent].run({ task, workspace, signal })) {
        yield event;
        if (event.kind === 'finished') return;
      }
      yield finished(
        signal.aborted
          ? { status: 'cancelled' }
          : { status: 'failed', reason: 'The agent stopped without reporting a result.' },
      );
    } catch (error) {
      yield finished(
        signal.aborted ? { status: 'cancelled' } : { status: 'failed', reason: reasonOf(error) },
      );
    } finally {
      await workspaces.dispose(workspace);
    }
  };
