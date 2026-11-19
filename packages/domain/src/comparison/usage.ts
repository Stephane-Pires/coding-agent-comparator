import { z } from 'zod';

const count = z.number().int().nonnegative();

/**
 * What a run consumed, as its agent reports it, in one vocabulary for every agent.
 *
 * `costUsd` is what the run costs at the provider's API prices, whatever the account that paid for it. It is `null`
 * when the agent does not report a cost.
 */
export const Usage = z.object({
  /** Everything the model read, cached or not. */
  inputTokens: count,
  /** The part of `inputTokens` that was read from the provider's cache. */
  cachedInputTokens: count,
  outputTokens: count,
  costUsd: z.number().nonnegative().nullable(),
});
export type Usage = z.infer<typeof Usage>;

/** The tokens of a run as the agents can all give them: what was read apart from what was read from the cache. */
export interface TokenCounts {
  /** Input the model read that did not come from the cache, including what it wrote to the cache. */
  readonly uncachedInput: number;
  /** Input the model read from the cache. */
  readonly cachedInput: number;
  readonly output: number;
}

/**
 * The rule for counting tokens: **input tokens are everything the model read, cached or not**, with the cached
 * part given beside it.
 *
 * Agents count differently: one reports cached input apart from the rest, another includes it in its input
 * total. Each connector states its agent's numbers as `TokenCounts`, and this is the only place that adds them up,
 * so the same row means the same thing for every agent.
 */
export function countTokens({
  uncachedInput,
  cachedInput,
  output,
}: TokenCounts): Pick<Usage, 'inputTokens' | 'cachedInputTokens' | 'outputTokens'> {
  return { inputTokens: uncachedInput + cachedInput, cachedInputTokens: cachedInput, outputTokens: output };
}

/**
 * The totals of a run. `model` and `usage` are `null` when the agent reported none, as when it crashed before it
 * could.
 */
export const Metrics = z.object({
  /** The model the agent ran on, as the agent names it. */
  model: z.string().nullable(),
  /** From the start of the run to its end, workspace included. */
  durationMs: count,
  usage: Usage.nullable(),
  /** The tools the agent called, each call once. */
  toolCalls: count,
  /** The files in the workspace at the end of the run. */
  files: count,
});
export type Metrics = z.infer<typeof Metrics>;
