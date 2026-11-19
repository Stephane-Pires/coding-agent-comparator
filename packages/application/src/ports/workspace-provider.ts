import type { ResultAsync } from 'neverthrow';

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
  /** Removes the workspace. Never fails: a workspace that cannot be removed is the adapter's to report. */
  dispose(workspace: Workspace): Promise<void>;
}
