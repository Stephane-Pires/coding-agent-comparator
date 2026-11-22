import { query } from '@anthropic-ai/claude-agent-sdk';

import type { CodingAgent } from '@comparator/application';

import { followAbort } from './abort.ts';
import { getEnvironment } from './environment.ts';
import { ALLOWED_TOOLS } from './tools.ts';
import { createTranslator } from './translate.ts';

/** Claude Code through its SDK. Without `apiKey`, it uses the login already on the machine. */
export function createClaudeCodeAgent(model: string, apiKey: string | undefined): CodingAgent {
  return {
    async *run(task, workspace, signal) {
      const { controller, stopFollowing } = followAbort(signal);
      try {
        const messages = query({
          prompt: task,
          options: {
            cwd: workspace.path,
            env: getEnvironment(apiKey),
            model,
            settingSources: [], // ignore the machine's own Claude settings
            persistSession: false,
            permissionMode: 'dontAsk',
            allowedTools: ALLOWED_TOOLS,
            abortController: controller,
          },
        });
        const translate = createTranslator(workspace.path);
        for await (const message of messages) yield* translate(message);
      } finally {
        stopFollowing();
      }
    },
  };
}
