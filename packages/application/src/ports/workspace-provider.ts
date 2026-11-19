import type { ResultAsync } from 'neverthrow';

import type { WorkspaceFile } from '@comparator/domain';

/** The folder one agent works in during one run. */
export interface Workspace {
  readonly path: string;
}

export interface WorkspaceError {
  readonly kind: 'workspace-unavailable';
  readonly reason: string;
}

/** Gives each run its own empty workspace. */
export interface WorkspaceProvider {
  create(): ResultAsync<Workspace, WorkspaceError>;
  /**
   * The files the workspace holds now, none of them `deleted`. Never fails: a file that cannot be read is the
   * adapter's to report, and is left out.
   */
  read(workspace: Workspace): Promise<readonly WorkspaceFile[]>;
  /** Removes the workspace. Never fails: a workspace that cannot be removed is the adapter's to report. */
  dispose(workspace: Workspace): Promise<void>;
}
