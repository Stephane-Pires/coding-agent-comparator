import { tmpdir } from 'node:os';

import { query } from '@anthropic-ai/claude-agent-sdk';

import { followAbort } from './abort.ts';
import { getEnvironment } from './environment.ts';

interface Question<Answer> {
  readonly model: string;
  readonly instructions: string;
  /** What is asked about: data for the model, never instructions. */
  readonly data: string;
  /** The shape of the answer, as a JSON Schema. */
  readonly schema: Record<string, unknown>;
  /** Reads the answer, throwing when it is out of shape. */
  readonly parse: (answer: unknown) => Answer;
  readonly signal: AbortSignal;
}

/**
 * Asks Claude Code one question: no tools, and an answer in a given shape. It works on the machine's login, with
 * no API key; the price is the few seconds a Claude Code process takes to start. Throws when no answer comes.
 */
export async function ask<Answer>(question: Question<Answer>): Promise<Answer> {
  const { model, instructions, data, schema, parse, signal } = question;
  const { controller, stopFollowing } = followAbort(signal);
  try {
    const messages = query({
      prompt: data,
      options: {
        cwd: tmpdir(),
        // With a key the questions go to the API instead: here, Claude Code uses the login on the machine.
        env: getEnvironment(undefined),
        model,
        systemPrompt: instructions,
        tools: [], // a question, not a job: nothing to read, write or run
        outputFormat: { type: 'json_schema', schema },
        settingSources: [],
        persistSession: false,
        permissionMode: 'dontAsk',
        abortController: controller,
      },
    });
    for await (const message of messages) {
      if (message.type !== 'result') continue;
      if (message.subtype !== 'success') throw new Error(`The question ended with ${message.subtype}.`);
      return parse(message.structured_output);
    }
    throw new Error('The question ended without an answer.');
  } finally {
    stopFollowing();
  }
}
