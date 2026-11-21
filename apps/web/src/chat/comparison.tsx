'use client';

import type { Chat } from '@ai-sdk/react';
import { useCallback, useRef, useState } from 'react';

import type { AgentId, Task } from '@comparator/contracts';
import { ComparisonMetrics, type RunResult } from '@comparator/ui/components/comparison-metrics';
import { ComparisonView } from '@comparator/ui/components/comparison-view';
import { RunTracks, type RunTrack } from '@comparator/ui/components/run-tracks';
import { Snowfall } from '@comparator/ui/components/snowfall';
import { TaskCheckNotice, type TaskCheckState } from '@comparator/ui/components/task-check-notice';

import type { RunMessage } from '../lib/run-chat.ts';
import { useClock } from './clock.ts';
import { Run } from './run.tsx';

export interface ComparisonRun {
  readonly agent: AgentId;
  readonly chat: Chat<RunMessage>;
}

/**
 * A task whose runs do not exist: it is being checked, or it was refused or stopped before they started. Nothing
 * of a run is shown: only the notice, which says which of the three it is.
 */
export function UnstartedComparison({ task, state }: { task: Task; state: TaskCheckState }) {
  return (
    <ComparisonView task={task} summary={<TaskCheckNotice state={state} />}>
      {null}
    </ComparisonView>
  );
}

/**
 * One task, the runs on their tracks, live, and the run of each agent on it; once every run has ended, the runs
 * in numbers.
 */
export function Comparison({
  task,
  runs,
  startedAt,
  onRunSettled,
}: {
  task: Task;
  runs: readonly ComparisonRun[];
  /** When the runs were started: a reading of `performance.now()`. */
  startedAt: number;
  onRunSettled: () => void;
}) {
  const [results, setResults] = useState<readonly RunResult[]>([]);
  // A run settles once. If it is heard a second time (a run's component can be mounted again, as hot reload does
  // in development), it is not counted twice: it would show the agent twice and release the Send button early.
  const heard = useRef(new Set<AgentId>());
  const onSettled = useCallback(
    (result: RunResult) => {
      if (heard.current.has(result.agent)) return;
      heard.current.add(result.agent);
      setResults((previous) => [...previous, result]);
      onRunSettled();
    },
    [onRunSettled],
  );
  // In the order of the columns, whichever run ended first.
  const ordered = runs.flatMap(({ agent }) => results.filter((result) => result.agent === agent));
  const ended = ordered.length === runs.length;

  // Where each run stands on its track, as each run reports it; the clock they share ticks until all have ended.
  const { now, read } = useClock(startedAt, !ended);
  const [tracks, setTracks] = useState<ReadonlyMap<AgentId, RunTrack>>(new Map());
  const onTrack = useCallback(
    (track: RunTrack) => setTracks((previous) => new Map(previous).set(track.agent, track)),
    [],
  );

  return (
    <ComparisonView
      task={task}
      tracks={
        <RunTracks
          now={now}
          tracks={runs.map(({ agent }) => tracks.get(agent) ?? { agent, status: 'running', gates: [] })}
        />
      }
      summary={
        <>
          {ended ? <ComparisonMetrics runs={ordered} /> : null}
          {/* It snows once when every agent finished: not for a run that failed or was stopped. */}
          {ended && ordered.every(({ status }) => status === 'succeeded') ? <Snowfall /> : null}
        </>
      }
    >
      {runs.map(({ agent, chat }) => (
        <Run key={agent} agent={agent} chat={chat} clock={read} onTrack={onTrack} onSettled={onSettled} />
      ))}
    </ComparisonView>
  );
}
