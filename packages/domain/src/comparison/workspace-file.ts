import { z } from 'zod';

/**
 * One file of a run's workspace, as it stands now.
 *
 * It is a snapshot: a later report for the same `path` replaces the earlier one. `content` is the whole text when
 * the state is `complete`, and empty when the file is `binary` or was `deleted`.
 */
export const WorkspaceFile = z.object({
  /** Relative to the workspace, with `/` between folders. */
  path: z.string(),
  content: z.string(),
  state: z.enum(['complete', 'binary', 'deleted']),
});
export type WorkspaceFile = z.infer<typeof WorkspaceFile>;
