import { anthropicQuestions } from '@comparator/connector-anthropic-api';
import { claudeCodeCommandLine } from '@comparator/connector-claude-code/command-line';
import { codexCommandLine } from '@comparator/connector-codex/command-line';
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
export function hostedRuntime(config: Config): Runtime {
  const { model, apiKey } = config.taskCheck;
  // `readConfig` refuses the sandbox runtime without both keys: this only tells the compiler so.
  if (apiKey === undefined) throw new Error('The sandbox runtime needs ANTHROPIC_API_KEY.');
  return {
    ...sandboxRuntime(
      {
        'claude-code': claudeCodeCommandLine(config.claudeCode),
        codex: codexCommandLine(config.codex),
      },
      { runLimitMs: config.sandboxRunLimitMs },
    ),
    ...anthropicQuestions({ model, apiKey }),
  };
}
