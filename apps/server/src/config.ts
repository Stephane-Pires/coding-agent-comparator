import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

/** An empty value in `.env` (`KEY=`) means "not set". */
const blankAsUnset = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(blankAsUnset, schema.optional());

/**
 * The model that asks the two questions about a task. Its full name, which both routes accept: the API does not
 * know the short ones. A small model: the questions are yes-or-no judgements on a few lines.
 */
const QUESTIONS_MODEL = 'claude-haiku-5-5';

const Environment = z.object({
  ANTHROPIC_API_KEY: optional(z.string()),
  OPENAI_API_KEY: optional(z.string()),
  CLAUDE_CODE_MODEL: optional(z.string()).default('haiku'),
  CODEX_MODEL: optional(z.string()).default('gpt-6-luna'),
  AGENT_RUNTIME: optional(z.enum(['local', 'recorded', 'sandbox'])),
  DEMO_PASSWORD: optional(z.string().min(8).max(200)),
  /** Set by Vercel on everything it runs. */
  VERCEL: optional(z.string()),
  RECORDED_PACE_MS: optional(z.coerce.number().int().min(0)).default(60),
  PORT: optional(z.coerce.number().int().min(1).max(65_535)).default(3001),
});

export interface Config {
  readonly port: number;
  /** The one password of the app. Not set: the API is open, which is for a dev machine only. */
  readonly password: string | undefined;
  /** On Vercel: the address is public, and served over HTTPS. */
  readonly hosted: boolean;
  /**
   * What runs a task. `local`: the real agents, on this machine. `sandbox`: the real agents, each in a Vercel
   * Sandbox. `recorded`: recordings of real runs, with no key and no login.
   */
  readonly runtime: 'local' | 'recorded' | 'sandbox';
  /** In the `recorded` runtime, the milliseconds between two steps of an agent. */
  readonly recordedPaceMs: number;
  readonly claudeCode: { readonly model: string; readonly apiKey: string | undefined };
  readonly codex: { readonly model: string; readonly apiKey: string | undefined };
  /** The two questions about a task (is it a coding task, was it done): with a key they go to the API. */
  readonly taskCheck: { readonly model: string; readonly apiKey: string | undefined };
}

/** Reads the configuration from the environment. The error says which variable is wrong and why. */
export function readConfig(env: Readonly<Record<string, string | undefined>>): Result<Config, string> {
  const parsed = Environment.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return err(`Invalid configuration. Fix these in .env or the environment:\n- ${problems.join('\n- ')}`);
  }
  const { data } = parsed;
  // On Vercel there is no machine of ours to run an agent on: a sandbox is the only place.
  const runtime = data.AGENT_RUNTIME ?? (data.VERCEL === undefined ? 'local' : 'sandbox');
  // A sandbox has no login to fall back on.
  const missing = [
    ...(data.ANTHROPIC_API_KEY === undefined ? ['ANTHROPIC_API_KEY'] : []),
    ...(data.OPENAI_API_KEY === undefined ? ['OPENAI_API_KEY'] : []),
  ];
  if (runtime === 'sandbox' && missing.length > 0)
    return err(
      `Invalid configuration. The agents run in a sandbox, which has no login: set ${missing.join(' and ')} in .env or the environment.`,
    );
  // A hosted API has a public address: without a password, anyone who finds it spends the keys.
  if (data.VERCEL !== undefined && data.DEMO_PASSWORD === undefined)
    return err(
      'Invalid configuration. A hosted API must be private: set DEMO_PASSWORD, 8 characters or more, in the environment.',
    );
  return ok({
    port: data.PORT,
    password: data.DEMO_PASSWORD,
    hosted: data.VERCEL !== undefined,
    runtime,
    recordedPaceMs: data.RECORDED_PACE_MS,
    claudeCode: { model: data.CLAUDE_CODE_MODEL, apiKey: data.ANTHROPIC_API_KEY },
    codex: { model: data.CODEX_MODEL, apiKey: data.OPENAI_API_KEY },
    taskCheck: { model: QUESTIONS_MODEL, apiKey: data.ANTHROPIC_API_KEY },
  });
}
