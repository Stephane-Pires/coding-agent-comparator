import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import { createAnthropicQuestions } from '@comparator/connector-anthropic-api';
import {
  createClaudeCodeAgent,
  createClaudeCodeRunReviewer,
  createClaudeCodeTaskClassifier,
} from '@comparator/connector-claude-code';
import { createCodexAgent } from '@comparator/connector-codex';
import { createRecordedRuntime, Recording } from '@comparator/runtime-recorded';
import { createLocalWorkspaces } from '@comparator/workspace-local';

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
        classifier: createClaudeCodeTaskClassifier(model),
        reviewer: createClaudeCodeRunReviewer(model),
      }
    : createAnthropicQuestions(apiKey, model);
}

/**
 * Every runtime a machine of ours can use, chosen by `AGENT_RUNTIME`: the agents on this machine, the agents in
 * sandboxes, or recordings.
 */
export function machineRuntime(config: Config): Runtime {
  const runtimes = {
    local: (): Runtime => ({
      agents: {
        'claude-code': createClaudeCodeAgent(config.claudeCode.model, config.claudeCode.apiKey),
        codex: createCodexAgent(config.codex.model, config.codex.apiKey),
      },
      workspaces: createLocalWorkspaces(),
      ...questions(config),
    }),
    sandbox: () => hostedRuntime(config),
    recorded: () =>
      createRecordedRuntime(
        z.array(Recording).parse(JSON.parse(readFileSync(RECORDINGS_FILE, 'utf8'))),
        config.recordedPaceMs,
      ),
  };
  return runtimes[config.runtime]();
}
