import { ConversationEmptyState } from '@comparator/ui/components/ai-elements/conversation';
import { TwinTracks } from '@comparator/ui/components/twin-tracks';

/** The page before the first comparison: what to do, and one task to start from. */
export function EmptyComparison() {
  return (
    <ConversationEmptyState>
      <TwinTracks className="w-60" />
      <h2 className="text-lg font-medium">Same slope, two agents.</h2>
      <p className="text-sm text-muted-foreground">Give both agents the same task and watch their runs.</p>
      <p className="text-sm text-muted-foreground">
        Try: <span className="text-foreground">“Write a slugify function with tests, then run them.”</span>
      </p>
    </ConversationEmptyState>
  );
}
