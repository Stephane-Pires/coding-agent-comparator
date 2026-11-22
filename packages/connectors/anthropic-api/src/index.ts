import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

import {
  RUN_REVIEW_INSTRUCTIONS,
  TASK_CHECK_INSTRUCTIONS,
  formatTask,
  formatWork,
  type RunReviewer,
  type TaskClassifier,
} from '@comparator/application';
import { RunReview, TaskAssessment } from '@comparator/domain';

/** The part of the SDK's client this adapter uses: one request whose answer is checked against a schema. */
export type Messages = Pick<Anthropic['messages'], 'parse'>;

interface Question<Schema extends z.ZodType> {
  readonly model: string;
  readonly instructions: string;
  /** What is asked about: data for the model, never instructions. */
  readonly data: string;
  readonly schema: Schema;
  readonly signal: AbortSignal;
}

/** Room for the model's own reasoning and one short sentence. */
const MAX_ANSWER_TOKENS = 2048;

/** A question is worth a short wait and one more try, not more: the use cases carry on without an answer. */
const QUESTION_TIMEOUT_MS = 20_000;
const QUESTION_RETRIES = 1;

/**
 * Asks the model one question and returns its answer in the shape of `schema`. Throws when the request fails, when
 * the model declines, or when no answer in that shape comes back: the use cases decide what that means.
 */
async function ask<Schema extends z.ZodType>(
  messages: Messages,
  question: Question<Schema>,
): Promise<z.infer<Schema>> {
  const { model, instructions, data, schema, signal } = question;
  const response = await messages.parse(
    {
      model,
      max_tokens: MAX_ANSWER_TOKENS,
      system: instructions,
      messages: [{ role: 'user', content: data }],
      // A yes-or-no judgement on a few lines of text: the lightest effort is enough, and the quickest.
      output_config: { effort: 'low', format: zodOutputFormat(schema) },
    },
    { signal },
  );
  if (response.parsed_output === null)
    throw new Error(
      `The model gave no answer in the expected shape (${response.stop_reason ?? 'no reason'}).`,
    );
  return response.parsed_output;
}

/**
 * The two questions about a task, asked to the Anthropic API directly: one request each, no agent and no process to
 * start. It is what answers them where Claude Code cannot run, and the quicker route wherever a key is set.
 * `model` is the model's full name, as the API knows it.
 */
export function createAnthropicQuestions(
  apiKey: string,
  model: string,
  messages: Messages = new Anthropic({ apiKey, timeout: QUESTION_TIMEOUT_MS, maxRetries: QUESTION_RETRIES })
    .messages,
): { readonly classifier: TaskClassifier; readonly reviewer: RunReviewer } {
  return {
    classifier: {
      assess: (task, signal) =>
        ask(messages, {
          model,
          instructions: TASK_CHECK_INSTRUCTIONS,
          data: formatTask(task),
          schema: TaskAssessment,
          signal,
        }),
    },
    reviewer: {
      review: (work, signal) =>
        ask(messages, {
          model,
          instructions: RUN_REVIEW_INSTRUCTIONS,
          data: formatWork(work),
          schema: RunReview,
          signal,
        }),
    },
  };
}
