import { z } from 'zod';

export const TASK_MAX_LENGTH = 10_000;

/**
 * What the user asks the agents to do. A value of this type is already valid: it is parsed once, where it
 * enters the system, and never checked again.
 */
export const Task = z.string().trim().min(1).max(TASK_MAX_LENGTH).brand<'Task'>();
export type Task = z.infer<typeof Task>;
