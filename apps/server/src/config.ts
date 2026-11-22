import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

import { PASSWORD_MAX_CHARACTERS } from '@comparator/contracts';

export interface Config {
  readonly port: number;
  /** The one password of the app. Not set: the API is open, which is for a dev machine only. */
  readonly password: string | undefined;
  /** On Vercel: the address is public, and served over HTTPS. */
  readonly isHosted: boolean;
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

/** Why the configuration cannot be used. `describeConfigError` says it in words. */
export type ConfigError =
  | { readonly kind: 'invalid-variables'; readonly problems: readonly string[] }
  | { readonly kind: 'missing-keys'; readonly names: readonly string[] }
  | { readonly kind: 'missing-password' };

/**
 * The model that asks the two questions about a task. Its full name, which both routes accept: the API does not
 * know the short ones. A small model: the questions are yes-or-no judgements on a few lines.
 */
const QUESTIONS_MODEL = 'claude-haiku-5-5';

/** Short enough to type, long enough not to be guessed in the hours a wrong try costs a second each. */
const PASSWORD_MIN_CHARACTERS = 8;

/** An empty value in `.env` (`KEY=`) means "not set". */
const ignoreBlank = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(ignoreBlank, schema.optional());

const Environment = z.object({
  ANTHROPIC_API_KEY: optional(z.string()),
  OPENAI_API_KEY: optional(z.string()),
  CLAUDE_CODE_MODEL: optional(z.string()).default('haiku'),
  CODEX_MODEL: optional(z.string()).default('gpt-6-luna'),
  AGENT_RUNTIME: optional(z.enum(['local', 'recorded', 'sandbox'])),
  DEMO_PASSWORD: optional(z.string().min(PASSWORD_MIN_CHARACTERS).max(PASSWORD_MAX_CHARACTERS)),
  /** Set by Vercel on everything it runs. */
  VERCEL: optional(z.string()),
  RECORDED_PACE_MS: optional(z.coerce.number().int().min(0)).default(60),
  PORT: optional(z.coerce.number().int().min(1).max(65_535)).default(3001),
});

/** What to tell whoever starts the server: which variable to fix, and how. */
export function describeConfigError(error: ConfigError): string {
  switch (error.kind) {
    case 'invalid-variables':
      return `Invalid configuration. Fix these in .env or the environment:\n- ${error.problems.join('\n- ')}`;
    case 'missing-keys':
      return `Invalid configuration. The agents run in a sandbox, which has no login: set ${error.names.join(' and ')} in .env or the environment.`;
    case 'missing-password':
      return `Invalid configuration. A hosted API must be private: set DEMO_PASSWORD, ${PASSWORD_MIN_CHARACTERS} characters or more, in the environment.`;
  }
}

/** Reads the configuration from the environment. The error says which variable is wrong and why. */
export function readConfig(env: Readonly<Record<string, string | undefined>>): Result<Config, ConfigError> {
  const parsed = Environment.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    return err({ kind: 'invalid-variables', problems });
  }
  const { data } = parsed;
  const isHosted = data.VERCEL !== undefined;
  // On Vercel there is no machine of ours to run an agent on: a sandbox is the only place.
  const runtime = data.AGENT_RUNTIME ?? (isHosted ? 'sandbox' : 'local');
  // A sandbox has no login to fall back on.
  const missing = [
    ...(data.ANTHROPIC_API_KEY === undefined ? ['ANTHROPIC_API_KEY'] : []),
    ...(data.OPENAI_API_KEY === undefined ? ['OPENAI_API_KEY'] : []),
  ];
  if (runtime === 'sandbox' && missing.length > 0) return err({ kind: 'missing-keys', names: missing });
  // A hosted API has a public address: without a password, anyone who finds it spends the keys.
  if (isHosted && data.DEMO_PASSWORD === undefined) return err({ kind: 'missing-password' });
  return ok({
    port: data.PORT,
    password: data.DEMO_PASSWORD,
    isHosted,
    runtime,
    recordedPaceMs: data.RECORDED_PACE_MS,
    claudeCode: { model: data.CLAUDE_CODE_MODEL, apiKey: data.ANTHROPIC_API_KEY },
    codex: { model: data.CODEX_MODEL, apiKey: data.OPENAI_API_KEY },
    taskCheck: { model: QUESTIONS_MODEL, apiKey: data.ANTHROPIC_API_KEY },
  });
}
