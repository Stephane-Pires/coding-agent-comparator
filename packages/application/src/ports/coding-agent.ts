import type { AgentEvent, Task } from '@comparator/domain';

import type { Workspace } from './workspace-provider.ts';

/**
 * A coding agent that can run a task in a workspace. Aborting the signal stops the agent.
 *
 * The adapter translates what its agent reports into `AgentEvent`s. It may stop early, or throw when the agent
 * crashes or is aborted: `startRun` turns that into the run's `finished` event, so the rule lives in one place.
 */
export interface CodingAgent {
  run(task: Task, workspace: Workspace, signal: AbortSignal): AsyncIterable<AgentEvent>;
}
