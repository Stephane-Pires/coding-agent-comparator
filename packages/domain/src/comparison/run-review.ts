import { z } from 'zod';

import type { RunOutcome } from './run-event.ts';

/**
 * What a reviewer says about the work of a run that ended without error: one sentence for the user, then whether
 * the task was done. The sentence comes first so that a model writes its reason before it commits to the answer.
 */
export const RunReview = z.object({
  /** One sentence for the user: what the agent delivered, or what is missing. */
  reason: z.string(),
  /** The agent delivered what the task asked for. */
  taskDone: z.boolean(),
});
export type RunReview = z.infer<typeof RunReview>;

const { $schema: _dialect, ...reviewSchema } = z.toJSONSchema(RunReview);
/** `RunReview` as a JSON Schema, for a model that answers in a given shape (see `TASK_ASSESSMENT_JSON_SCHEMA`). */
export const RUN_REVIEW_JSON_SCHEMA: Record<string, unknown> = reviewSchema;

/**
 * The rule for a run whose agent stopped without error: **it succeeded only if its task was done.** Otherwise it is
 * incomplete, with the reviewer's sentence as the reason.
 */
export function reviewedOutcome({ taskDone, reason }: RunReview): RunOutcome {
  return taskDone ? { status: 'succeeded' } : { status: 'incomplete', reason };
}
