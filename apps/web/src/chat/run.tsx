'use client';

import { useChat, type Chat } from '@ai-sdk/react';
import type { ChatStatus } from 'ai';
import { useEffect, useState } from 'react';

import type { AgentId, RunOutcome, RunStatus } from '@comparator/contracts';
import type { RunResult } from '@comparator/ui/components/comparison-metrics';
import { RunColumn, type RunItem } from '@comparator/ui/components/run-column';
import type { RunTrack } from '@comparator/ui/components/run-tracks';

import type { RunMessage } from '../lib/run-chat.ts';

/** Shown when the stream itself broke: the API is down, or the connection was lost. */
const UNREACHABLE =
  'The run could not be followed: the API did not answer. Check that it is running, then send again.';

/**
 * Where a run stands when its stream has said no outcome: one that ends without one was stopped by the user, and
 * one that breaks never reached the API.
 */
const STATUS_WITHOUT_OUTCOME: Record<ChatStatus, RunStatus> = {
  submitted: 'running',
  streaming: 'running',
  ready: 'cancelled',
  error: 'failed',
};

/** Why a run did not finish: the outcome's reason, or that the stream broke. */
function getReason(outcome: RunOutcome | undefined, stream: ChatStatus): string | undefined {
  if (outcome?.status === 'failed' || outcome?.status === 'incomplete') return outcome.reason;
  if (stream === 'error') return UNREACHABLE;
  return undefined;
}

/**
 * One agent's run, followed live. Tells its parent once, when the run is over: how it ended, and its totals. And
 * tells it, each time something happens, where the run stands on its track: `clock` gives the time to stamp it.
 */
export function Run({
  agent,
  chat,
  clock,
  onTrack,
  onSettled,
}: {
  agent: AgentId;
  chat: Chat<RunMessage>;
  clock: () => number;
  onTrack: (track: RunTrack) => void;
  onSettled: (result: RunResult) => void;
}) {
  const { messages, status: stream } = useChat({ chat });

  const parts = messages
    .filter((message) => message.role === 'assistant')
    .flatMap((message) => message.parts);
  // What the agent said and did, in the order the stream delivered it. A tool call that was sent again when it
  // ended has replaced its first version in place, so each call appears once, in its latest state.
  const items = parts.flatMap((part, index): RunItem[] => {
    if (part.type === 'text')
      return part.text === '' ? [] : [{ type: 'message', id: String(index), text: part.text }];
    if (part.type === 'data-tool-call') return [{ type: 'tool-call', call: part.data }];
    return [];
  });
  // The workspace's files: one that changed has replaced its earlier version in place, as a tool call does.
  const files = parts.flatMap((part) => (part.type === 'data-file' ? [part.data] : []));
  const outcome = parts.find((part) => part.type === 'data-outcome')?.data;
  // The totals arrive just before the outcome: they are there when the run settles.
  const metrics = parts.find((part) => part.type === 'data-metrics')?.data;

  const status = outcome?.status ?? STATUS_WITHOUT_OUTCOME[stream];
  const reason = getReason(outcome, stream);

  const isSettled = status !== 'running';
  useEffect(() => {
    // Once, when the run settles: its status and totals do not change after that.
    if (isSettled) onSettled({ agent, status, metrics });
  }, [isSettled, onSettled]);

  // When each tool call was first seen, and when the run ended: the browser's own times, since the stream carries
  // none. They place the gates and the end of the track; the duration shown is the API's.
  const [seen, setSeen] = useState<ReadonlyMap<string, number>>(new Map());
  const [endedAt, setEndedAt] = useState<number>();
  const calls = items.flatMap((item) => (item.type === 'tool-call' ? [item.call] : []));
  const callIds = calls.map(({ id }) => id).join(' ');
  useEffect(() => {
    const at = clock();
    setSeen((previous) => {
      const fresh = calls.filter(({ id }) => !previous.has(id));
      return fresh.length === 0
        ? previous
        : new Map([...previous, ...fresh.map(({ id }) => [id, at] as const)]);
    });
  }, [callIds, clock]);
  useEffect(() => {
    if (isSettled) setEndedAt(clock());
  }, [isSettled, clock]);
  const track: RunTrack = {
    agent,
    status,
    gates: calls.flatMap(({ id, status: callStatus, tool }) => {
      const at = seen.get(id);
      return at === undefined ? [] : [{ id, at, status: callStatus, tool }];
    }),
    endedAt,
    durationMs: metrics?.durationMs,
  };
  const trackKey = JSON.stringify(track);
  useEffect(() => onTrack(track), [trackKey, onTrack]);

  return <RunColumn agent={agent} status={status} items={items} files={files} reason={reason} />;
}
