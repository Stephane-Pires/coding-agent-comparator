import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { checkTask, reviewRun, startRun } from '@comparator/application';
import { anthropicQuestions } from '@comparator/connector-anthropic-api';
import {
  claudeCodeAgent,
  claudeCodeCommandLine,
  claudeCodeRunReviewer,
  claudeCodeTaskClassifier,
} from '@comparator/connector-claude-code';
import { codexAgent, codexCommandLine } from '@comparator/connector-codex';
import { recordedRuntime, Recording, type RecordedRuntime } from '@comparator/runtime-recorded';
import { sandboxRuntime } from '@comparator/runtime-sandbox';
import { localWorkspaces } from '@comparator/workspace-local';

import type { AppDeps } from './app.ts';
import type { Config } from './config.ts';

/** The recordings of real runs that the `recorded` runtime replays (`pnpm fixtures:record` makes them). */
export const RECORDINGS_FILE = join(import.meta.dirname, '../../../fixtures/recordings.json');

/**
 * What answers the two questions about a task (is it a coding task, was it done): the same small model either
 * way. With a key, the Anthropic API directly, in under a second. Without one, Claude Code on the machine's login,
 * which takes the few seconds a process needs to start.
 */
export function questions(config: Config): Pick<RecordedRuntime, 'classifier' | 'reviewer'> {
  const { model, apiKey } = config.taskCheck;
  return apiKey === undefined
    ? {
        classifier: claudeCodeTaskClassifier({ model, apiKey }),
        reviewer: claudeCodeRunReviewer({ model, apiKey }),
      }
    : anthropicQuestions({ model, apiKey });
}

/** The real agents on this machine, each in a temporary folder. */
function localRuntime(config: Config): RecordedRuntime {
  return {
    agents: {
      'claude-code': claudeCodeAgent(config.claudeCode),
      codex: codexAgent(config.codex),
    },
    workspaces: localWorkspaces(),
    ...questions(config),
  };
}

/**
 * The real agents, each in a Vercel Sandbox: a machine made for the run and destroyed after it. Each agent is
 * started there by its own command, with its own key and nothing else of ours.
 */
function hostedRuntime(config: Config): RecordedRuntime {
  return {
    ...sandboxRuntime(
      {
        'claude-code': claudeCodeCommandLine(config.claudeCode),
        // Codex's own inner sandbox cannot start inside a Vercel Sandbox, which already isolates the run.
        codex: codexCommandLine({ ...config.codex, confinement: 'danger-full-access' }),
      },
      { runLimitMs: config.sandboxRunLimitMs },
    ),
    ...questions(config),
  };
}

/** The composition root: the only place that knows which adapter stands behind each port. */
export function createContainer(config: Config): AppDeps {
  const runtimes = {
    local: () => localRuntime(config),
    sandbox: () => hostedRuntime(config),
    recorded: () =>
      recordedRuntime(z.array(Recording).parse(JSON.parse(readFileSync(RECORDINGS_FILE, 'utf8'))), {
        paceMs: config.recordedPaceMs,
      }),
  };
  const { agents, workspaces, classifier, reviewer } = runtimes[config.runtime]();
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
