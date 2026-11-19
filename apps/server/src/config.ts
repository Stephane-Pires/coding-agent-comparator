import { err, ok, type Result } from 'neverthrow';
import { z } from 'zod';

/** An empty value in `.env` (`KEY=`) means "not set". */
const blankAsUnset = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(blankAsUnset, schema.optional());

const Environment = z.object({
  ANTHROPIC_API_KEY: optional(z.string()),
  OPENAI_API_KEY: optional(z.string()),
  CLAUDE_CODE_MODEL: optional(z.string()).default('haiku'),
  CODEX_MODEL: optional(z.string()).default('gpt-6-luna'),
  TASK_CHECK_MODEL: optional(z.string()).default('haiku'),
  PORT: optional(z.coerce.number().int().min(1).max(65_535)).default(3001),
});

export interface Config {
  readonly port: number;
  readonly claudeCode: { readonly model: string; readonly apiKey: string | undefined };
  readonly codex: { readonly model: string; readonly apiKey: string | undefined };
  /** The check that a task is a coding task: asked to Claude Code, with its credentials. */
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
  return ok({
    port: data.PORT,
    claudeCode: { model: data.CLAUDE_CODE_MODEL, apiKey: data.ANTHROPIC_API_KEY },
    codex: { model: data.CODEX_MODEL, apiKey: data.OPENAI_API_KEY },
    taskCheck: { model: data.TASK_CHECK_MODEL, apiKey: data.ANTHROPIC_API_KEY },
  });
}
