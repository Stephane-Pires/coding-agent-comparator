import type { RunStatus } from '@comparator/contracts';
import { ICONS } from '@comparator/ui/icons';
import { cn } from '@comparator/ui/lib/utils';

/**
 * The word and the tone of each status. The words are those of a run on a ski course (docs/design/look-and-feel.md,
 * Voice): a run finished, did not finish, or was stopped. Colour is never the only signal: the
 * icon and the word say it too.
 */
const STATUSES: Record<RunStatus, { label: string; tone: string }> = {
  running: { label: 'Running', tone: 'text-muted-foreground' },
  succeeded: { label: 'Finished', tone: 'text-success' },
  // Not an error: the agent stopped cleanly, without having done its task. Grey, with the reason in its column.
  incomplete: { label: 'Incomplete', tone: 'text-muted-foreground' },
  failed: { label: 'Did not finish', tone: 'text-destructive' },
  cancelled: { label: 'Stopped', tone: 'text-muted-foreground' },
};

/** Shows where a run stands: running, or how it ended. */
export function RunStatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const { label, tone } = STATUSES[status];
  const Icon = ICONS.run[status];
  return (
    <span role="status" className={cn('inline-flex items-center gap-1 text-sm font-medium', tone, className)}>
      <Icon aria-hidden="true" className={cn('size-4', status === 'running' && 'animate-spin')} />
      {label}
    </span>
  );
}
