import type { ReactNode } from 'react';

import { Message, MessageContent } from '@comparator/ui/components/ai-elements/message';

/**
 * One comparison: the task that was sent, then one run per agent, side by side when there is room.
 * The columns follow the page grid, read on the width this block really gets.
 */
export function ComparisonView({ task, children }: { task: string; children: ReactNode }) {
  return (
    <article className="@container flex flex-col gap-4">
      <Message from="user">
        <MessageContent className="whitespace-pre-wrap">{task}</MessageContent>
      </Message>
      <div className="page-grid *:col-span-full @cols-8:*:col-span-4 @cols-12:*:col-span-6">{children}</div>
    </article>
  );
}
