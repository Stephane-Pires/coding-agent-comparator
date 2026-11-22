import { z } from 'zod';

/**
 * What a classifier says about a task: two facts, and one sentence for the user. The sentence comes first so that a
 * model writes its reason before it commits to the two answers.
 */
export const TaskAssessment = z.object({
  /** One sentence for the user: what will be built, or what is missing and how to rephrase. */
  reason: z.string(),
  /** The task asks to write, change, fix or test software. */
  isCodingTask: z.boolean(),
  /** Doing the task well leaves at least one file in the folder. */
  hasFileResult: z.boolean(),
});
export type TaskAssessment = z.infer<typeof TaskAssessment>;

const { $schema: _dialect, ...assessmentSchema } = z.toJSONSchema(TaskAssessment);
/**
 * `TaskAssessment` as a JSON Schema, for a model that answers in a given shape. Without the `$schema` line: a
 * validator that does not know that dialect's address refuses the whole schema.
 */
export const TASK_ASSESSMENT_JSON_SCHEMA: Record<string, unknown> = assessmentSchema;

/** Whether the agents may run a task. A refusal says why, in words meant for the user. */
export const TaskVerdict = z.discriminatedUnion('verdict', [
  z.object({ verdict: z.literal('accepted') }),
  z.object({ verdict: z.literal('refused'), reason: z.string() }),
]);
export type TaskVerdict = z.infer<typeof TaskVerdict>;

/**
 * The rule for accepting a task: **it is a coding task, and its result is files.** The comparator compares what two
 * agents leave in a folder; a task that only calls for a written answer leaves nothing to compare.
 */
export const getVerdict = ({ isCodingTask, hasFileResult, reason }: TaskAssessment): TaskVerdict =>
  isCodingTask && hasFileResult ? { verdict: 'accepted' } : { verdict: 'refused', reason };
