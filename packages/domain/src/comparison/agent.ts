import { z } from 'zod';

/** The coding agents a task can be sent to. */
export const AgentId = z.enum(['claude-code', 'codex']);
export type AgentId = z.infer<typeof AgentId>;
