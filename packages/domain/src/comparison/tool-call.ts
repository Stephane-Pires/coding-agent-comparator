import { z } from 'zod';

/** A page a web search returned. */
export const WebSource = z.object({ title: z.string(), url: z.string() });
export type WebSource = z.infer<typeof WebSource>;

/** What an agent called. Every agent names its tools differently; these are the kinds the comparator tells apart. */
export const Tool = z.discriminatedUnion('type', [
  z.object({ type: z.literal('command'), command: z.string() }),
  z.object({ type: z.literal('web-search'), query: z.string(), sources: z.array(WebSource) }),
  /** Any other tool: its name as the agent calls it, and its input in a few words. */
  z.object({ type: z.literal('other'), name: z.string(), input: z.string() }),
]);
export type Tool = z.infer<typeof Tool>;

/**
 * One call of a tool by an agent, as it stands now. An agent reports a call at least twice: when it starts
 * (`running`) and when it ends. Each report carries everything known so far, so the latest one for an `id`
 * replaces the earlier ones.
 */
export const ToolCall = z.object({
  id: z.string(),
  tool: Tool,
  status: z.enum(['running', 'succeeded', 'failed']),
  /** What the tool printed or returned. Empty while it runs, and for a tool that returns nothing to show. */
  output: z.string(),
});
export type ToolCall = z.infer<typeof ToolCall>;
