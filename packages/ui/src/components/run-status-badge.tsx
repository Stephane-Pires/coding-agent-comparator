import type { RunStatus } from '@comparator/contracts';
import { ICONS } from '@comparator/ui/icons';
import { cn } from '@comparator/ui/lib/utils';

/** The word and the tone of each status. Colour is never the only signal: the icon and the word say it too. */
const STATUSES: Record<RunStatus, { label: string; tone: string }> = {
  running: { label: 'Running', tone: 'text-muted-foreground' },
  succeeded: { label: 'Succeeded', tone: 'text-success' },
  failed: { label: 'Failed', tone: 'text-destructive' },
  cancelled: { label: 'Cancelled', tone: 'text-muted-foreground' },
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
