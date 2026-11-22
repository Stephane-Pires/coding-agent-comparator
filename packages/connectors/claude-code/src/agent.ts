import { query } from '@anthropic-ai/claude-agent-sdk';

import type { CodingAgent } from '@comparator/application';

import { environment } from './environment.ts';
import { ALLOWED_TOOLS } from './tools.ts';
import { createTranslator } from './translate.ts';

interface ClaudeCodeOptions {
  readonly model: string;
  /** Without a key, Claude Code uses the login already on the machine. */
  readonly apiKey: string | undefined;
}

export function claudeCodeAgent({ model, apiKey }: ClaudeCodeOptions): CodingAgent {
  return {
    async *run(task, workspace, signal) {
      const abortController = new AbortController();
      const abort = () => abortController.abort();
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      try {
        const messages = query({
          prompt: task,
          options: {
            cwd: workspace.path,
            env: environment(apiKey),
            model,
            settingSources: [], // ignore the machine's own Claude settings
            persistSession: false,
            permissionMode: 'dontAsk',
            allowedTools: ALLOWED_TOOLS,
            abortController,
          },
        });
        const translate = createTranslator(workspace.path);
        for await (const message of messages) yield* translate(message);
      } finally {
        signal.removeEventListener('abort', abort);
      }
    },
  };
}
