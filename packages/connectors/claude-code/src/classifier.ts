import { tmpdir } from 'node:os';

import { query } from '@anthropic-ai/claude-agent-sdk';

import { TASK_CHECK_INSTRUCTIONS, taskAsData, type TaskClassifier } from '@comparator/application';
import { TASK_ASSESSMENT_JSON_SCHEMA, TaskAssessment } from '@comparator/domain';

import { environment } from './environment.ts';

interface ClassifierOptions {
  readonly model: string;
  /** Without a key, Claude Code uses the login already on the machine. */
  readonly apiKey: string | undefined;
}

/**
 * Checks a task by asking Claude Code one question: no tools, and an answer in a given shape. It works on the
 * machine's login, with no API key; the price is the few seconds a Claude Code process takes to start.
 */
export function claudeCodeTaskClassifier({ model, apiKey }: ClassifierOptions): TaskClassifier {
  return {
    async assess(task, signal) {
      const abortController = new AbortController();
      const abort = () => abortController.abort();
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
      try {
        const messages = query({
          prompt: taskAsData(task),
          options: {
            cwd: tmpdir(),
            env: environment(apiKey),
            model,
            systemPrompt: TASK_CHECK_INSTRUCTIONS,
            tools: [], // a question, not a job: nothing to read, write or run
            outputFormat: { type: 'json_schema', schema: TASK_ASSESSMENT_JSON_SCHEMA },
            settingSources: [],
            persistSession: false,
            permissionMode: 'dontAsk',
            abortController,
          },
        });
        for await (const message of messages) {
          if (message.type !== 'result') continue;
          if (message.subtype !== 'success') throw new Error(`The task check ended with ${message.subtype}.`);
          return TaskAssessment.parse(message.structured_output);
        }
        throw new Error('The task check ended without an answer.');
      } finally {
        signal.removeEventListener('abort', abort);
      }
    },
  };
}
