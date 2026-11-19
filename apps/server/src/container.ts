import { startRun } from '@comparator/application';
import { claudeCodeAgent } from '@comparator/connector-claude-code';
import { codexAgent } from '@comparator/connector-codex';
import { localWorkspaces } from '@comparator/workspace-local';

import type { AppDeps } from './app.ts';
import type { Config } from './config.ts';

/** The composition root: the only place that knows which adapter stands behind each port. */
export function createContainer(config: Config): AppDeps {
  return {
    startRun: startRun({
      agents: {
        'claude-code': claudeCodeAgent(config.claudeCode),
        codex: codexAgent(config.codex),
      },
      workspaces: localWorkspaces(),
    }),
  };
}
