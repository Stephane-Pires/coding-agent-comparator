import { checkTask, reviewRun, startRun } from '@comparator/application';
import type { RecordedRuntime } from '@comparator/runtime-recorded';

import type { AppDeps } from './api.ts';

/** What runs a task and answers the two questions about it: one adapter behind each port. */
export type Runtime = RecordedRuntime;

/**
 * Builds the use cases on a runtime. Which runtime is the choice of the entry file: `runtimes/local.ts` holds
 * those of a machine of ours, `runtimes/hosted.ts` the one of a hosted API.
 */
export function createContainer({ agents, workspaces, classifier, reviewer }: Runtime): AppDeps {
  // One check for the whole API: a run finds the verdict its comparison already asked for.
  const check = checkTask({ classifier });
  return {
    checkTask: check,
    startRun: startRun({
      agents,
      workspaces,
      clock: { now: () => performance.now() },
      checkTask: check,
      reviewRun: reviewRun({ reviewer }),
    }),
  };
}
