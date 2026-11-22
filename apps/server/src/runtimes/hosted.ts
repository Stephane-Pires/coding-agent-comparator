import { createAnthropicQuestions } from '@comparator/connector-anthropic-api';
import { createClaudeCodeCommandLine } from '@comparator/connector-claude-code/command-line';
import { createCodexCommandLine } from '@comparator/connector-codex/command-line';
import { sandboxRuntime } from '@comparator/runtime-sandbox';

import type { Config } from '../config.ts';
import type { Runtime } from '../container.ts';

/**
 * The real agents, each in a Vercel Sandbox: a machine made for the run and destroyed after it. Each agent is
 * started there by its own command, with its own key and nothing else of ours. The two questions go to the
 * Anthropic API.
 *
 * Nothing this file imports loads an agent's SDK, and it must stay so: a hosted API is a function of 250 MB at
 * most, and the two agents weigh 700 MB. That is why the agents' descriptions come from `/command-line`.
 */
/**
 * The longest a run may take. A hosted API is a function that Vercel stops at 300 seconds: the run is ended first,
 * with a sentence that says so, and its sandbox stopped.
 */
const RUN_LIMIT_MS = 240_000;

/**
 * How much the hosted app may be used, by everyone together: 3 comparisons at once and 20 an hour, two runs each.
 * The free plan allows 10 sandboxes at once; the hour keeps the keys and the monthly allowance safe.
 */
const LIMITS = { atOnce: 6, perHour: 40 };

export function hostedRuntime(config: Config): Runtime {
  const { model, apiKey } = config.taskCheck;
  // `readConfig` refuses the sandbox runtime without both keys: this only tells the compiler so.
  if (apiKey === undefined) throw new Error('The sandbox runtime needs ANTHROPIC_API_KEY.');
  return {
    ...sandboxRuntime(
      {
        'claude-code': createClaudeCodeCommandLine(config.claudeCode.model, config.claudeCode.apiKey),
        codex: createCodexCommandLine(config.codex.model, config.codex.apiKey),
      },
      { runLimitMs: RUN_LIMIT_MS, limits: LIMITS },
    ),
    ...createAnthropicQuestions(apiKey, model),
  };
}
