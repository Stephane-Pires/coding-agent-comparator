'use client';

import { useCallback, useState } from 'react';

import { AgentId, type Task } from '@comparator/contracts';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@comparator/ui/components/ai-elements/conversation';
import { EmptyComparison } from '@comparator/ui/components/empty-comparison';
import { PageHeader } from '@comparator/ui/components/page-header';
import { TaskInput } from '@comparator/ui/components/task-input';

import { startRunChat } from '../lib/run-chat.ts';
import { Comparison, type ComparisonRun } from './comparison.tsx';

/** One task, sent to every agent: one run each. */
interface SentComparison {
  readonly id: string;
  readonly task: Task;
  readonly runs: readonly ComparisonRun[];
}

export function ChatPage() {
  const [comparisons, setComparisons] = useState<readonly SentComparison[]>([]);
  // How many runs are still in progress. Send and Stop are one button, chosen by this.
  const [inProgress, setInProgress] = useState(0);

  const send = (task: Task) => {
    const runs = AgentId.options.map((agent) => ({ agent, chat: startRunChat(agent, task) }));
    setComparisons((previous) => [...previous, { id: crypto.randomUUID(), task, runs }]);
    setInProgress((count) => count + runs.length);
  };
  const stop = () => {
    for (const { chat } of comparisons.at(-1)?.runs ?? []) void chat.stop();
  };
  const onSettled = useCallback(() => setInProgress((count) => count - 1), []);

  return (
    <div className="flex h-dvh flex-col">
      <div className="page-frame py-4">
        <PageHeader title="Twin Tracks" />
      </div>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="page-frame gap-8 py-4">
          {comparisons.length === 0 ? (
            <EmptyComparison />
          ) : (
            comparisons.map((comparison) => (
              <Comparison
                key={comparison.id}
                task={comparison.task}
                runs={comparison.runs}
                onRunSettled={onSettled}
              />
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="page-frame border-t py-4">
        <TaskInput running={inProgress > 0} onSend={send} onStop={stop} />
      </div>
    </div>
  );
}
