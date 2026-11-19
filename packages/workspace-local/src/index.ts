import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ResultAsync } from 'neverthrow';

import type { WorkspaceProvider } from '@comparator/application';

/**
 * Workspaces on this machine: each one is a new empty folder under the OS temp directory. It is outside the
 * repository on purpose, so an agent does not pick up this project's files, instructions or Git history.
 */
export function localWorkspaces(): WorkspaceProvider {
  return {
    create: () =>
      // The real path, with no symbolic link in it: the path an agent reports for its own files (on macOS the
      // temp directory is a link).
      ResultAsync.fromPromise(
        mkdtemp(join(tmpdir(), 'comparator-')).then((path) => realpath(path)),
        (error) => ({
          kind: 'workspace-unavailable' as const,
          reason: `Could not create a workspace folder: ${error instanceof Error ? error.message : String(error)}`,
        }),
      ).map((path) => ({ path })),
    async dispose(workspace) {
      try {
        await rm(workspace.path, { recursive: true, force: true });
      } catch (error) {
        console.error(`Could not remove the workspace ${workspace.path}:`, error);
      }
    },
  };
}
