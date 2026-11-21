import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { checkTask, reviewRun, startRun } from '@comparator/application';
import {
  claudeCodeAgent,
  claudeCodeRunReviewer,
  claudeCodeTaskClassifier,
} from '@comparator/connector-claude-code';
import { codexAgent } from '@comparator/connector-codex';
import { recordedRuntime, Recording, type RecordedRuntime } from '@comparator/runtime-recorded';
import { localWorkspaces } from '@comparator/workspace-local';

import type { AppDeps } from './app.ts';
import type { Config } from './config.ts';

/** The recordings of real runs that the `recorded` runtime replays (`pnpm fixtures:record` makes them). */
export const RECORDINGS_FILE = join(import.meta.dirname, '../../../fixtures/recordings.json');

/** The real agents on this machine, each in a temporary folder, and Claude Code for the two questions. */
function localRuntime(config: Config): RecordedRuntime {
  return {
    agents: {
      'claude-code': claudeCodeAgent(config.claudeCode),
      codex: codexAgent(config.codex),
    },
    workspaces: localWorkspaces(),
    // The same small model answers both questions: is the task a coding task, and was it done.
    classifier: claudeCodeTaskClassifier(config.taskCheck),
    reviewer: claudeCodeRunReviewer(config.taskCheck),
  };
}

/** The composition root: the only place that knows which adapter stands behind each port. */
export function createContainer(config: Config): AppDeps {
  const { agents, workspaces, classifier, reviewer } =
    config.runtime === 'recorded'
      ? recordedRuntime(z.array(Recording).parse(JSON.parse(readFileSync(RECORDINGS_FILE, 'utf8'))), {
          paceMs: config.recordedPaceMs,
        })
      : localRuntime(config);
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
