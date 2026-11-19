import type { AgentEvent, Task } from '@comparator/domain';

import type { Workspace } from './workspace-provider.ts';

export interface AgentRun {
  readonly task: Task;
  readonly workspace: Workspace;
  /** Aborting it stops the agent. */
  readonly signal: AbortSignal;
}

/**
 * A coding agent that can run a task in a workspace.
 *
 * The adapter translates what its agent reports into `AgentEvent`s. It may stop early, or throw when the agent
 * crashes or is aborted: `startRun` turns that into the run's `finished` event, so the rule lives in one place.
 */
export interface CodingAgent {
  run(run: AgentRun): AsyncIterable<AgentEvent>;
}
