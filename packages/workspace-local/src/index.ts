import { mkdtemp, readdir, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ResultAsync } from 'neverthrow';

import type { WorkspaceProvider } from '@comparator/application';
import type { WorkspaceFile } from '@comparator/domain';

/** Folders an agent fills without writing them: installed dependencies and Git's own data. */
const SKIPPED_FOLDERS = new Set(['node_modules', '.git']);

/** The path, relative to `root`, of every regular file under it. A link is not followed: it can point outside. */
async function getFilePaths(root: string, folder = ''): Promise<string[]> {
  const entries = await readdir(join(root, folder), { withFileTypes: true });
  const found = await Promise.all(
    entries.map(async (entry) => {
      const path = folder === '' ? entry.name : `${folder}/${entry.name}`;
      if (entry.isDirectory()) return SKIPPED_FOLDERS.has(entry.name) ? [] : getFilePaths(root, path);
      return entry.isFile() ? [path] : [];
    }),
  );
  return found.flat();
}

async function readWorkspaceFile(root: string, path: string): Promise<WorkspaceFile> {
  const bytes = await readFile(join(root, path));
  // A zero byte does not occur in text.
  return bytes.includes(0)
    ? { path, content: '', state: 'binary' }
    : { path, content: bytes.toString('utf8'), state: 'complete' };
}

/**
 * Workspaces on this machine: each one is a new empty folder under the OS temp directory. It is outside the
 * repository on purpose, so an agent does not pick up this project's files, instructions or Git history.
 */
export function createLocalWorkspaces(): WorkspaceProvider {
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
    async read(workspace) {
      try {
        const paths = await getFilePaths(workspace.path);
        // A file can vanish between being listed and being read: the agent is still at work.
        const files = await Promise.allSettled(
          paths.toSorted().map((path) => readWorkspaceFile(workspace.path, path)),
        );
        return files.flatMap((file) => (file.status === 'fulfilled' ? [file.value] : []));
      } catch (error) {
        console.error(`Could not read the workspace ${workspace.path}:`, error);
        return [];
      }
    },
    async dispose(workspace) {
      try {
        await rm(workspace.path, { recursive: true, force: true });
      } catch (error) {
        console.error(`Could not remove the workspace ${workspace.path}:`, error);
      }
    },
  };
}
