import { checkTask, reviewRun, startRun } from '@comparator/application';
import {
  claudeCodeAgent,
  claudeCodeRunReviewer,
  claudeCodeTaskClassifier,
} from '@comparator/connector-claude-code';
import { codexAgent } from '@comparator/connector-codex';
import { localWorkspaces } from '@comparator/workspace-local';

import type { AppDeps } from './app.ts';
import type { Config } from './config.ts';

/** The composition root: the only place that knows which adapter stands behind each port. */
export function createContainer(config: Config): AppDeps {
  // One check for the whole API: a run finds the verdict its comparison already asked for.
  const check = checkTask({ classifier: claudeCodeTaskClassifier(config.taskCheck) });
  return {
    checkTask: check,
    startRun: startRun({
      agents: {
        'claude-code': claudeCodeAgent(config.claudeCode),
        codex: codexAgent(config.codex),
      },
      workspaces: localWorkspaces(),
      clock: { now: () => performance.now() },
      checkTask: check,
      // The same small model answers both questions: is the task a coding task, and was it done.
      reviewRun: reviewRun({ reviewer: claudeCodeRunReviewer(config.taskCheck) }),
    }),
  };
}
