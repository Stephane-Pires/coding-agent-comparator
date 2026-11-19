'use client';

import type { Chat } from '@ai-sdk/react';
import { useCallback, useState } from 'react';

import type { AgentId, Task } from '@comparator/contracts';
import { ComparisonMetrics, type RunResult } from '@comparator/ui/components/comparison-metrics';
import { ComparisonView } from '@comparator/ui/components/comparison-view';

import type { RunMessage } from '../lib/run-chat.ts';
import { Run } from './run.tsx';

export interface ComparisonRun {
  readonly agent: AgentId;
  readonly chat: Chat<RunMessage>;
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

  return (
    <ComparisonView
      task={task}
      summary={ordered.length === runs.length ? <ComparisonMetrics runs={ordered} /> : null}
    >
      {runs.map(({ agent, chat }) => (
        <Run key={agent} agent={agent} chat={chat} onSettled={onSettled} />
      ))}
    </ComparisonView>
  );
}
