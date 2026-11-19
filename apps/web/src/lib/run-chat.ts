import { Chat } from '@ai-sdk/react';
import { eventIteratorToUnproxiedDataStream } from '@orpc/client';
import type { ChatTransport, UIMessage } from 'ai';

import type { AgentId, Metrics, RunOutcome, Task, ToolCall, WorkspaceFile } from '@comparator/contracts';

import { api } from './api.ts';

/**
 * A message of a run's stream: text parts, with the tool calls, the files, the run's totals and its outcome as
 * typed data parts.
 */
export type RunMessage = UIMessage<
  never,
  { outcome: RunOutcome; 'tool-call': ToolCall; file: WorkspaceFile; metrics: Metrics }
>;

/** Connects a chat to one agent: sending a message starts a run of that agent, and stopping aborts it. */
function runTransport(agent: AgentId, task: Task): ChatTransport<RunMessage> {
  return {
    sendMessages: async ({ abortSignal }) =>
      eventIteratorToUnproxiedDataStream(
        await api.runs.start({ agent, task }, abortSignal ? { signal: abortSignal } : {}),
      ),
    // A run cannot be picked up again after the connection is lost.
    reconnectToStream: () => Promise.resolve(null),
  };
}

/** Starts a run of `agent` on `task` and returns the chat that follows it. */
export function startRunChat(agent: AgentId, task: Task): Chat<RunMessage> {
  const chat = new Chat<RunMessage>({ transport: runTransport(agent, task) });
  void chat.sendMessage({ text: task });
  return chat;
}
