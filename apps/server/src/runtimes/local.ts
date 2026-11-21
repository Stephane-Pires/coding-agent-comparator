import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { anthropicQuestions } from '@comparator/connector-anthropic-api';
import {
  claudeCodeAgent,
  claudeCodeRunReviewer,
  claudeCodeTaskClassifier,
} from '@comparator/connector-claude-code';
import { codexAgent } from '@comparator/connector-codex';
import { recordedRuntime, Recording } from '@comparator/runtime-recorded';
import { localWorkspaces } from '@comparator/workspace-local';

import type { Config } from '../config.ts';
import type { Runtime } from '../container.ts';
import { hostedRuntime } from './hosted.ts';

/** The recordings of real runs that the `recorded` runtime replays (`pnpm fixtures:record` makes them). */
export const RECORDINGS_FILE = join(import.meta.dirname, '../../../../fixtures/recordings.json');

/**
 * What answers the two questions about a task (is it a coding task, was it done): the same small model either
 * way. With a key, the Anthropic API directly, in under a second. Without one, Claude Code on the machine's login,
 * which takes the few seconds a process needs to start.
 */
export function questions(config: Config): Pick<Runtime, 'classifier' | 'reviewer'> {
  const { model, apiKey } = config.taskCheck;
  return apiKey === undefined
    ? {
        classifier: claudeCodeTaskClassifier({ model }),
        reviewer: claudeCodeRunReviewer({ model }),
      }
    : anthropicQuestions({ model, apiKey });
}

/**
 * Every runtime a machine of ours can use, chosen by `AGENT_RUNTIME`: the agents on this machine, the agents in
 * sandboxes, or recordings.
 */
export function machineRuntime(config: Config): Runtime {
  const runtimes = {
    local: (): Runtime => ({
      agents: {
        'claude-code': claudeCodeAgent(config.claudeCode),
        codex: codexAgent(config.codex),
      },
      workspaces: localWorkspaces(),
      ...questions(config),
    }),
    sandbox: () => hostedRuntime(config),
    recorded: () =>
      recordedRuntime(z.array(Recording).parse(JSON.parse(readFileSync(RECORDINGS_FILE, 'utf8'))), {
        paceMs: config.recordedPaceMs,
      }),
  };
  return runtimes[config.runtime]();
}
