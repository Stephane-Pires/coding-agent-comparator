import { z } from 'zod';

import { ToolCall } from './tool-call.ts';

/** How a run ended. */
export const RunOutcome = z.discriminatedUnion('status', [
  z.object({ status: z.literal('succeeded') }),
  z.object({ status: z.literal('failed'), reason: z.string() }),
  z.object({ status: z.literal('cancelled') }),
]);
export type RunOutcome = z.infer<typeof RunOutcome>;

/** Where a run stands. A run is running until it has an outcome; then its status is that outcome's. */
export type RunStatus = 'running' | RunOutcome['status'];

/**
 * One thing that happened during a run, in the vocabulary shared by every agent.
 * A run is a sequence of events that ends with exactly one `finished` event.
 */
export const RunEvent = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('message'), text: z.string() }),
  z.object({ kind: z.literal('tool-call'), call: ToolCall }),
  z.object({ kind: z.literal('finished'), outcome: RunOutcome }),
]);
export type RunEvent = z.infer<typeof RunEvent>;
