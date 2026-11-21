import { ICONS } from '@comparator/ui/icons';

/** Where a comparison stands before its runs exist: being checked, refused, or stopped by the user. */
export type TaskCheckState =
  | { readonly status: 'checking' }
  | { readonly status: 'refused'; readonly reason: string }
  | { readonly status: 'stopped' };

const CARD = 'flex flex-col gap-1 rounded-lg border bg-card p-4 text-sm';

/**
 * What a comparison shows in place of its runs while its task is checked, and when no run was started. It is one
 * card that changes its words, so the answer comes where the question was. While the task is checked it says so,
 * and why: nothing of a run is shown before it is known that there will be one. A refusal is not an error: nothing
 * failed, so it is grey, and its one sentence says how to rephrase.
 */
export function TaskCheckNotice({ state }: { state: TaskCheckState }) {
  if (state.status === 'checking')
    return (
      <div role="status" className={CARD}>
        <p className="flex items-center gap-2 font-medium">
          <ICONS.run.running aria-hidden="true" className="size-4 animate-spin text-muted-foreground" />
          Checking the task
        </p>
        <p className="text-muted-foreground">
          The agents only run a task that asks for code. They start as soon as this one is checked.
        </p>
      </div>
    );
  const Icon = ICONS.run.cancelled;
  return (
    <div role="status" className={CARD}>
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
