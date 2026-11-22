import { Codex } from '@openai/codex-sdk';

import type { CodingAgent } from '@comparator/application';

import { translate } from './translate.ts';

/**
 * The environment of the agent's process. The SDK inherits nothing once `env` is given, so `PATH` and `HOME`
 * are passed on here. Credentials come from the options only.
 */
function getEnvironment(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined && !/^(OPENAI_|CODEX_)/.test(entry[0]),
    ),
  );
}

/** Codex through its SDK. Without `apiKey`, it uses the login already on the machine. */
export function createCodexAgent(model: string, apiKey: string | undefined): CodingAgent {
  return {
    async *run(task, workspace, signal) {
      const codex = new Codex({ env: getEnvironment(), ...(apiKey === undefined ? {} : { apiKey }) });
      const thread = codex.startThread({
        workingDirectory: workspace.path,
        skipGitRepoCheck: true, // the workspace is an empty folder, not a repository
        model,
        modelReasoningEffort: 'low',
        // Unattended: never ask for approval, and write inside the workspace only.
        approvalPolicy: 'never',
        sandboxMode: 'workspace-write',
        networkAccessEnabled: true,
        webSearchMode: 'live',
      });
      // Codex's events never name the model: this is the one it was asked to use.
      yield { kind: 'model', model };
      const { events } = await thread.runStreamed(task, { signal });
      for await (const event of events) yield* translate(event, workspace.path);
    },
  };
}
