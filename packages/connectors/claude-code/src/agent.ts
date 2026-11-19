import { query } from '@anthropic-ai/claude-agent-sdk';

import type { CodingAgent } from '@comparator/application';

import { translate } from './translate.ts';

interface ClaudeCodeOptions {
  readonly model: string;
  /** Without a key, Claude Code uses the login already on the machine. */
  readonly apiKey: string | undefined;
}

/** Tools approved in advance, so a run never waits for a person to answer a permission prompt. */
const ALLOWED_TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebSearch', 'WebFetch'];

/**
 * The environment of the agent's process. Credentials come from the options only: a key or a setting left in
 * the server's own environment would silently take priority over the machine's login.
 */
function environment(apiKey: string | undefined): Record<string, string | undefined> {
  const inherited = Object.entries(process.env).filter(([name]) => !/^(ANTHROPIC_|CLAUDE)/.test(name));
  return { ...Object.fromEntries(inherited), ...(apiKey === undefined ? {} : { ANTHROPIC_API_KEY: apiKey }) };
}

export function claudeCodeAgent({ model, apiKey }: ClaudeCodeOptions): CodingAgent {
  return {
    async *run({ task, workspace, signal }) {
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
        for await (const message of messages) yield* translate(message);
      } finally {
        signal.removeEventListener('abort', abort);
      }
    },
  };
}
