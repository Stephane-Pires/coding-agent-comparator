import type { ReactNode } from 'react';

import { Message, MessageContent } from '@comparator/ui/components/ai-elements/message';

/**
 * One comparison: the task that was sent, then what `tracks` gives: the runs on their slope. Then one run per
 * agent, side by side when there is room, then what `summary` gives: the runs in numbers, once they have ended.
 *
 * The tracks stay in view at the top while the runs under them grow and scroll: they are the comparison at a
 * glance, and nothing that arrives below can push them.
 * The columns follow the page grid, read on the width this block really gets.
 */
export function ComparisonView({
  task,
  tracks,
  children,
  summary,
}: {
  task: string;
  tracks?: ReactNode;
  children: ReactNode;
  summary?: ReactNode;
}) {
  return (
    <article className="@container flex flex-col gap-4">
      <Message from="user">
        <MessageContent className="whitespace-pre-wrap">{task}</MessageContent>
      </Message>
      {tracks ? <div className="sticky top-0 z-10">{tracks}</div> : null}
      <div className="grid gap-4 @cols-8:grid-cols-2 @cols-8:gap-6">{children}</div>
      {summary}
    </article>
  );
}
