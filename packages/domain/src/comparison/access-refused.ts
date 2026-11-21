/**
 * What a provider says when it refuses the app itself, whatever the task: a key it does not know, an account with
 * no credit left, a quota that is used up, no credential at all. The words are the providers' own, and they can
 * change: a refusal that is not recognised is simply an ordinary failure.
 */
const REFUSALS = [
  // Anthropic, through Claude Code
  /invalid api key/i,
  /authentication_error/i,
  /credit balance is too low/i,
  /not logged in/i,
  // OpenAI, through Codex
  /incorrect api key/i,
  /invalid_api_key/i,
  /missing bearer or basic authentication/i,
  /insufficient_quota/i,
  /exceeded your current quota/i,
  /billing_not_active/i,
];

/**
 * Whether a run failed because the app's access to its provider was refused. Such a run says nothing about the
 * agent or the task: the agent never got to work.
 */
export function accessRefused(reason: string): boolean {
  return REFUSALS.some((refusal) => refusal.test(reason));
}

/**
 * What a provider says when it is limiting requests for now: too many at once, or too busy. Checked after
 * `accessRefused`, because OpenAI answers an empty account with a 429 too: that one is the app's to fix, not a wait.
 */
const LIMITED = [/rate.?limit/i, /too many requests/i, /overloaded/i, /\b429\b/];

/** Whether a run failed because its provider is limiting requests for now: trying again later can work. */
export function rateLimited(reason: string): boolean {
  return LIMITED.some((limit) => limit.test(reason));
}
