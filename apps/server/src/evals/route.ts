import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { RunReviewer, TaskClassifier } from '@comparator/application';

import { describeConfigError, readConfig } from '../config.ts';
import { createQuestions } from '../runtimes/local.ts';

/**
 * What an evaluation measures: the two questions as the server would ask them, on the route named on the command
 * line. `api` is the Anthropic API directly and needs a key; `claude-code` is Claude Code, always on the
 * machine's login. With no name, it is the route the server itself would take.
 */
export function getRoute(): {
  name: string;
  model: string;
  classifier: TaskClassifier;
  reviewer: RunReviewer;
} {
  const envFile = join(import.meta.dirname, '../../../../.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const read = readConfig(process.env);
  if (read.isErr()) throw new Error(describeConfigError(read.error));
  const config = read.value;
  const asked = process.argv[2];
  if (asked !== undefined && asked !== 'api' && asked !== 'claude-code')
    throw new Error(`Unknown route "${asked}": use "api" or "claude-code".`);
  const { model, apiKey } = config.taskCheck;
  if (asked === 'api' && apiKey === undefined) throw new Error('The "api" route needs ANTHROPIC_API_KEY.');
  const name = asked ?? (apiKey === undefined ? 'claude-code' : 'api');
  // Claude Code is the route the server takes when it has no key: asking for it by name hides the key from the
  // choice, and Claude Code then runs on the machine's login.
  const taskCheck = name === 'claude-code' ? { model, apiKey: undefined } : { model, apiKey };
  return { name, model, ...createQuestions({ ...config, taskCheck }) };
}
