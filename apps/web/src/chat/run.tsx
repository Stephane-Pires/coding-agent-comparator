'use client';

import { useChat, type Chat } from '@ai-sdk/react';
import { useEffect } from 'react';

import type { AgentId, RunStatus } from '@comparator/contracts';
import { RunColumn } from '@comparator/ui/components/run-column';

import type { RunMessage } from '../lib/run-chat.ts';

/** Shown when the stream itself broke: the API is down, or the connection was lost. */
const UNREACHABLE =
  'The run could not be followed: the API did not answer. Check that it is running, then send again.';

/** One agent's run, followed live. Tells its parent once, when the run is over. */
export function Run({
  agent,
  chat,
  onSettled,
}: {
  agent: AgentId;
  chat: Chat<RunMessage>;
  onSettled: () => void;
}) {
  const { messages, status: stream } = useChat({ chat });

  const parts = messages
    .filter((message) => message.role === 'assistant')
    .flatMap((message) => message.parts);
  const texts = parts.flatMap((part, index) =>
    part.type === 'text' && part.text !== '' ? [{ id: String(index), text: part.text }] : [],
  );
  const outcome = parts.find((part) => part.type === 'data-outcome')?.data;

  // A stream that ends with no outcome was stopped by the user; one that breaks never reached the API.
  const status: RunStatus =
    outcome?.status ?? (stream === 'error' ? 'failed' : stream === 'ready' ? 'cancelled' : 'running');
  const failureReason =
    outcome?.status === 'failed' ? outcome.reason : stream === 'error' ? UNREACHABLE : undefined;

  const settled = status !== 'running';
  useEffect(() => {
    if (settled) onSettled();
  }, [settled, onSettled]);

  return <RunColumn agent={agent} status={status} messages={texts} failureReason={failureReason} />;
}
