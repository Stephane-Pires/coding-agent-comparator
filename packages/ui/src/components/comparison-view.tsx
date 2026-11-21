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
        {/* The question is the one pink block of a comparison: it stands apart from what the agents answer. */}
        <MessageContent className="whitespace-pre-wrap group-[.is-user]:bg-asked group-[.is-user]:text-asked-foreground">
          {task}
        </MessageContent>
      </Message>
      {tracks ? <div className="sticky top-0 z-10">{tracks}</div> : null}
      <div className="page-grid *:col-span-full @cols-8:*:col-span-4 @cols-12:*:col-span-6">{children}</div>
      {summary}
    </article>
  );
}
