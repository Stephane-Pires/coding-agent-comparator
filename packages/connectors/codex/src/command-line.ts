import type { ThreadEvent } from '@openai/codex-sdk';

import type { AgentEvent } from '@comparator/domain';

import { translate } from './translate.ts';

/** A printed line is an event of the SDK when it is an object that says its type: `--json` promises it. */
const isEvent = (line: unknown): line is ThreadEvent =>
  typeof line === 'object' && line !== null && 'type' in line;

interface CommandLineOptions {
  readonly model: string;
  readonly apiKey: string | undefined;
  /**
   * How far Codex confines its own commands. `workspace-write` is its inner sandbox, which needs a normal machine.
   * `danger-full-access` turns it off: only for a machine that is itself a throwaway sandbox, where the inner one
   * cannot start and the outer one already isolates the run.
   */
  readonly confinement: 'workspace-write' | 'danger-full-access';
}

/**
 * Codex as a program started by a command, for where its SDK cannot start it: a machine other than ours.
 * `codex exec --json` prints the very events the SDK hands over, one per line, so the same translator reads them.
 * The options mirror those of `codexAgent`.
 */
export function codexCommandLine({ model, apiKey, confinement }: CommandLineOptions) {
  return {
    command: (task: string) => ({
      cmd: 'codex',
      args: [
        'exec',
        '--json',
        '--skip-git-repo-check', // the workspace is an empty folder, not a repository
        '--model',
        model,
        '--sandbox',
        confinement,
        '--config',
        'model_reasoning_effort="low"',
        '--config',
        'approval_policy="never"',
        '--config',
        'web_search="live"',
        task,
      ],
      env: apiKey === undefined ? {} : { CODEX_API_KEY: apiKey },
    }),
    start(workspacePath: string) {
      // Codex's events never name the model: this is the one it was asked to use.
      const first: AgentEvent[] = [{ kind: 'model', model }];
      return {
        first,
        translate: (line: unknown) => (isEvent(line) ? translate(line, workspacePath) : []),
      };
    },
  };
}
