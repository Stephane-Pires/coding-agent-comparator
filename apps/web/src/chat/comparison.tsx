'use client';

import type { Chat } from '@ai-sdk/react';
import { useCallback, useState } from 'react';

import type { AgentId, Task } from '@comparator/contracts';
import { ComparisonMetrics, type RunResult } from '@comparator/ui/components/comparison-metrics';
import { ComparisonView } from '@comparator/ui/components/comparison-view';
import { Snowfall } from '@comparator/ui/components/snowfall';
import { TaskCheckNotice, type TaskCheckState } from '@comparator/ui/components/task-check-notice';

import type { RunMessage } from '../lib/run-chat.ts';
import { Run } from './run.tsx';

export interface ComparisonRun {
  readonly agent: AgentId;
  readonly chat: Chat<RunMessage>;
}

/** A task whose runs do not exist: it is being checked, or it was refused or stopped before they started. */
export function UnstartedComparison({ task, state }: { task: Task; state: TaskCheckState }) {
  return (
    <ComparisonView task={task} summary={<TaskCheckNotice state={state} />}>
      {null}
    </ComparisonView>
  );
}

/** One task and the run of each agent on it; once every run has ended, the runs in numbers. */
export function Comparison({
  task,
  runs,
  onRunSettled,
}: {
  task: Task;
  runs: readonly ComparisonRun[];
  onRunSettled: () => void;
}) {
  const [results, setResults] = useState<readonly RunResult[]>([]);
  const onSettled = useCallback(
    (result: RunResult) => {
      setResults((previous) => [...previous, result]);
      onRunSettled();
    },
    [onRunSettled],
  );
  // In the order of the columns, whichever run ended first.
  const ordered = runs.flatMap(({ agent }) => results.filter((result) => result.agent === agent));

  const ended = ordered.length === runs.length;

  return (
    <ComparisonView
      task={task}
      summary={
        ended ? (
          <>
            <ComparisonMetrics runs={ordered} />
            {/* It snows once when every agent finished: not for a run that failed or was stopped. */}
            {ordered.every(({ status }) => status === 'succeeded') ? <Snowfall /> : null}
          </>
        ) : null
      }
    >
      {runs.map(({ agent, chat }) => (
        <Run key={agent} agent={agent} chat={chat} onSettled={onSettled} />
      ))}
    </ComparisonView>
  );
}
