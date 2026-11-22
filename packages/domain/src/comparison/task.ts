import { z } from 'zod';

/** About four pages of text: room for a detailed task, not for a whole project pasted in. */
export const TASK_MAX_CHARACTERS = 10_000;

/**
 * What the user asks the agents to do. A value of this type is already valid: it is parsed once, where it
 * enters the system, and never checked again.
 */
export const Task = z.string().trim().min(1).max(TASK_MAX_CHARACTERS).brand<'Task'>();
export type Task = z.infer<typeof Task>;
