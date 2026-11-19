'use client';

import { useCallback, useRef, useState } from 'react';

import { AgentId, type Task, type TaskVerdict } from '@comparator/contracts';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@comparator/ui/components/ai-elements/conversation';
import { EmptyComparison } from '@comparator/ui/components/empty-comparison';
import { PageHeader } from '@comparator/ui/components/page-header';
import type { TaskCheckState } from '@comparator/ui/components/task-check-notice';
import { TaskInput } from '@comparator/ui/components/task-input';

import { api } from '../lib/api.ts';
import { startRunChat } from '../lib/run-chat.ts';
import { Comparison, UnstartedComparison, type ComparisonRun } from './comparison.tsx';

/** One task: checked first, then sent to every agent, one run each. */
interface SentComparison {
  readonly id: string;
  readonly task: Task;
  readonly state: TaskCheckState | { readonly status: 'started'; readonly runs: readonly ComparisonRun[] };
}

export function ChatPage() {
  const [comparisons, setComparisons] = useState<readonly SentComparison[]>([]);
  // How many checks and runs are still in progress. Send and Stop are one button, chosen by this.
  const [inProgress, setInProgress] = useState(0);
  // The check in progress, if any: Stop abandons it.
  const check = useRef<AbortController | null>(null);

  const send = (task: Task) => {
    const id = crypto.randomUUID();
    const controller = new AbortController();
    check.current = controller;
    const become = (state: SentComparison['state']) =>
      setComparisons((previous) => previous.map((sent) => (sent.id === id ? { ...sent, state } : sent)));
    setComparisons((previous) => [...previous, { id, task, state: { status: 'checking' } }]);
    setInProgress((count) => count + 1);
    const checkThenStart = async () => {
      // The check is a filter: when it cannot be made, the runs start, and the API checks again by itself.
      const verdict = await api.tasks
        .check({ task }, { signal: controller.signal })
        .catch((): TaskVerdict => ({ verdict: 'accepted' }));
      if (controller.signal.aborted) become({ status: 'stopped' });
      else if (verdict.verdict === 'refused') become({ status: 'refused', reason: verdict.reason });
      else {
        const runs = AgentId.options.map((agent) => ({ agent, chat: startRunChat(agent, task) }));
        become({ status: 'started', runs });
        setInProgress((count) => count + runs.length);
      }
      setInProgress((count) => count - 1);
    };
    void checkThenStart();
  };
  const stop = () => {
    check.current?.abort();
    const last = comparisons.at(-1);
    if (last?.state.status === 'started') for (const { chat } of last.state.runs) void chat.stop();
  };
  const onSettled = useCallback(() => setInProgress((count) => count - 1), []);

  return (
    <div className="flex h-dvh flex-col">
      <div className="page-frame py-4">
        <PageHeader title="Compare coding agents" />
      </div>
      {comparisons.length === 0 ? (
        // Not in the scrolling log: the empty page sits in the middle of the room between the header and the field.
        <main className="page-frame flex min-h-0 flex-1 overflow-y-auto">
          <EmptyComparison />
        </main>
      ) : (
        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="page-frame gap-8 py-4">
            {comparisons.map(({ id, task, state }) =>
              state.status === 'started' ? (
                <Comparison key={id} task={task} runs={state.runs} onRunSettled={onSettled} />
              ) : (
                <UnstartedComparison key={id} task={task} state={state} />
              ),
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      )}
      <div className="page-frame border-t py-4">
        <TaskInput running={inProgress > 0} onSend={send} onStop={stop} />
      </div>
    </div>
  );
}
