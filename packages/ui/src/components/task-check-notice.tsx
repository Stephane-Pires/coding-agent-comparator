import { ICONS } from '@comparator/ui/icons';

/** Where a comparison stands before its runs exist: being checked, refused, or stopped by the user. */
export type TaskCheckState =
  | { readonly status: 'checking' }
  | { readonly status: 'refused'; readonly reason: string }
  | { readonly status: 'stopped' };

/**
 * What a comparison shows in place of its runs while its task is checked, and when no run was started. A refusal is
 * not an error: nothing failed, so it is grey, and its one sentence says how to rephrase.
 */
export function TaskCheckNotice({ state }: { state: TaskCheckState }) {
  if (state.status === 'checking')
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <ICONS.run.running aria-hidden="true" className="size-4 animate-spin" />
        Checking the task…
      </p>
    );
  const Icon = ICONS.run.cancelled;
  return (
    <div role="status" className="flex flex-col gap-1 rounded-lg border bg-card p-4 text-sm">
      <p className="flex items-center gap-2 font-medium">
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        Not started
      </p>
      <p className="text-muted-foreground">
        {state.status === 'refused' ? state.reason : 'You stopped it before the agents started.'}
      </p>
    </div>
  );
}
