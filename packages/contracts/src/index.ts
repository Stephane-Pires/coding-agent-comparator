import { eventIterator, oc } from '@orpc/contract';
import { z } from 'zod';

import { AgentId, RunOutcome, Task, TASK_MAX_LENGTH, ToolCall, WorkspaceFile } from '@comparator/domain';

// The domain's vocabulary that clients need: they import it from here, never from the domain.
export { AgentId, RunOutcome, Task, TASK_MAX_LENGTH, ToolCall, WorkspaceFile };
export type { RunStatus, Tool } from '@comparator/domain';

export const RunInput = z.object({
  agent: AgentId.describe('The coding agent that runs the task.'),
  task: Task.describe('What the agent is asked to do, in plain language.'),
});
export type RunInput = z.infer<typeof RunInput>;

/**
 * One chunk of a run's stream. The chunks follow the AI SDK's UI message stream, so `useChat` renders them
 * unchanged: text arrives between `text-start` and `text-end`; tool calls, the workspace's files and the run's
 * outcome are typed data parts.
 */
export const RunChunk = z.discriminatedUnion('type', [
  z.object({ type: z.literal('start') }).describe('The run started.'),
  z.object({ type: z.literal('text-start'), id: z.string() }).describe('A message from the agent begins.'),
  z
    .object({ type: z.literal('text-delta'), id: z.string(), delta: z.string() })
    .describe('Text to append to the message with this id.'),
  z.object({ type: z.literal('text-end'), id: z.string() }).describe('The message with this id is complete.'),
  z
    .object({ type: z.literal('data-tool-call'), id: z.string(), data: ToolCall })
    .describe(
      'A tool the agent called, as it stands now. Sent again with the same id when the call ends: the later chunk replaces the earlier one.',
    ),
  z
    .object({ type: z.literal('data-file'), id: z.string(), data: WorkspaceFile })
    .describe(
      'A file of the workspace, as it stands now; the id is its path. Sent again when the file changes or is deleted: the later chunk replaces the earlier one.',
    ),
  z
    .object({ type: z.literal('data-outcome'), data: RunOutcome })
    .describe('How the run ended: succeeded, failed with a reason, or cancelled. Sent once.'),
  z.object({ type: z.literal('finish') }).describe('The stream is over.'),
]);
export type RunChunk = z.infer<typeof RunChunk>;

/** Why a request was refused: one issue per field that is wrong, with the path of the field. */
const InvalidInput = z.object({
  issues: z.array(
    z.looseObject({
      path: z.array(z.union([z.string(), z.number()])),
      message: z.string(),
    }),
  ),
});

export const contract = {
  runs: {
    start: oc
      .route({
        method: 'POST',
        path: '/runs',
        tags: ['Runs'],
        summary: 'Run one agent on a task',
        description:
          'Starts the agent in a fresh, empty workspace and streams what it does as server-sent events, until ' +
          'the run ends. To compare agents, call it once per agent with the same task. ' +
          'To cancel a run, close the connection.',
      })
      .errors({
        BAD_REQUEST: {
          status: 400,
          message: 'Input validation failed',
          data: InvalidInput,
        },
      })
      .input(RunInput)
      .output(eventIterator(RunChunk)),
  },
};
