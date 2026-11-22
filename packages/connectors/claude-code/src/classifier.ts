import { TASK_CHECK_INSTRUCTIONS, formatTask, type TaskClassifier } from '@comparator/application';
import { TASK_ASSESSMENT_JSON_SCHEMA, TaskAssessment } from '@comparator/domain';

import { ask } from './ask.ts';

/** Checks that a task is a coding task whose result is files, by asking Claude Code. */
export function createClaudeCodeTaskClassifier(model: string): TaskClassifier {
  return {
    assess: (task, signal) =>
      ask({
        model,
        instructions: TASK_CHECK_INSTRUCTIONS,
        data: formatTask(task),
        schema: TASK_ASSESSMENT_JSON_SCHEMA,
        parse: (answer) => TaskAssessment.parse(answer),
        signal,
      }),
  };
}
