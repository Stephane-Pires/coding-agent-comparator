import { z } from 'zod';

import { ToolCall } from './tool-call.ts';
import { Metrics, Usage } from './usage.ts';
import { WorkspaceFile } from './workspace-file.ts';

/**
 * How a run ended. `succeeded` and `incomplete` both mean the agent stopped without an error: in the first it did
 * its task, in the second it did not, as when it only asked a question back.
 */
export const RunOutcome = z.discriminatedUnion('status', [
  z.object({ status: z.literal('succeeded') }),
  z.object({ status: z.literal('incomplete'), reason: z.string() }),
  z.object({ status: z.literal('failed'), reason: z.string() }),
  z.object({ status: z.literal('cancelled') }),
]);
export type RunOutcome = z.infer<typeof RunOutcome>;

/** Where a run stands. A run is running until it has an outcome; then its status is that outcome's. */
export type RunStatus = 'running' | RunOutcome['status'];

const message = z.object({ kind: z.literal('message'), text: z.string() });
const toolCall = z.object({ kind: z.literal('tool-call'), call: ToolCall });
const finished = z.object({ kind: z.literal('finished'), outcome: RunOutcome });

/**
 * One thing an agent reports while it works, in the vocabulary shared by every agent: what it says, the tools it
 * calls, the model it runs on, what it consumed, and how it ended.
 */
export const AgentEvent = z.discriminatedUnion('kind', [
  message,
  toolCall,
  /** The model the agent runs on, as soon as it is known. */
  z.object({ kind: z.literal('model'), model: z.string() }),
  z.object({ kind: z.literal('usage'), usage: Usage }),
  finished,
]);
export type AgentEvent = z.infer<typeof AgentEvent>;

/**
 * One thing that happened during a run: what its agent said and did, and what the run itself observed, which are
 * the files of the workspace as they change and the run's totals.
 * A run is a sequence of events that ends with exactly one `finished` event.
 */
export const RunEvent = z.discriminatedUnion('kind', [
  message,
  toolCall,
  z.object({ kind: z.literal('file'), file: WorkspaceFile }),
  z.object({ kind: z.literal('metrics'), metrics: Metrics }),
  finished,
]);
export type RunEvent = z.infer<typeof RunEvent>;
