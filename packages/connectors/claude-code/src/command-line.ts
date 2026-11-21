import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

import type { AgentEvent } from '@comparator/domain';

import { ALLOWED_TOOLS } from './agent.ts';
import { createTranslator } from './translate.ts';

/** A printed line is a message of the SDK when it is an object that says its type: the output format promises it. */
const isMessage = (line: unknown): line is SDKMessage =>
  typeof line === 'object' && line !== null && 'type' in line;

interface CommandLineOptions {
  readonly model: string;
  readonly apiKey: string | undefined;
}

/**
 * Claude Code as a program started by a command, for where its SDK cannot start it: a machine other than ours.
 * `claude -p` with `stream-json` prints the very messages the SDK hands over, one per line, so the same translator
 * reads them. The options mirror those of `claudeCodeAgent`.
 */
export function claudeCodeCommandLine({ model, apiKey }: CommandLineOptions) {
  return {
    command: (task: string) => ({
      cmd: 'claude',
      args: [
        '--print',
        task,
        '--output-format',
        'stream-json',
        '--verbose', // `stream-json` prints every message only with it
        '--model',
        model,
        '--permission-mode',
        'dontAsk',
        '--allowedTools',
        ALLOWED_TOOLS.join(','),
        '--no-session-persistence',
        '--setting-sources',
        '',
      ],
      env: apiKey === undefined ? {} : { ANTHROPIC_API_KEY: apiKey },
    }),
    start(workspacePath: string) {
      const translate = createTranslator(workspacePath);
      return {
        first: [] as AgentEvent[],
        translate: (line: unknown) => (isMessage(line) ? translate(line) : []),
      };
    },
  };
}
