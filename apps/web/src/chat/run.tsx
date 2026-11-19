'use client';

import { useChat, type Chat } from '@ai-sdk/react';
import { useEffect } from 'react';

import type { AgentId, RunStatus } from '@comparator/contracts';
import type { RunResult } from '@comparator/ui/components/comparison-metrics';
import { RunColumn, type RunItem } from '@comparator/ui/components/run-column';

import type { RunMessage } from '../lib/run-chat.ts';

/** Shown when the stream itself broke: the API is down, or the connection was lost. */
const UNREACHABLE =
  'The run could not be followed: the API did not answer. Check that it is running, then send again.';

/** One agent's run, followed live. Tells its parent once, when the run is over: how it ended, and its totals. */
export function Run({
  agent,
  chat,
  onSettled,
}: {
  agent: AgentId;
  chat: Chat<RunMessage>;
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

  // A stream that ends with no outcome was stopped by the user; one that breaks never reached the API.
  const status: RunStatus =
    outcome?.status ?? (stream === 'error' ? 'failed' : stream === 'ready' ? 'cancelled' : 'running');
  const failureReason =
    outcome?.status === 'failed' ? outcome.reason : stream === 'error' ? UNREACHABLE : undefined;

  const settled = status !== 'running';
  useEffect(() => {
    // Once, when the run settles: its status and totals do not change after that.
    if (settled) onSettled({ agent, status, metrics });
  }, [settled, onSettled]);

  return (
    <RunColumn agent={agent} status={status} items={items} files={files} failureReason={failureReason} />
  );
}
