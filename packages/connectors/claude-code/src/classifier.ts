import { TASK_CHECK_INSTRUCTIONS, taskAsData, type TaskClassifier } from '@comparator/application';
import { TASK_ASSESSMENT_JSON_SCHEMA, TaskAssessment } from '@comparator/domain';

import { ask, type AskOptions } from './ask.ts';

/** Checks that a task is a coding task whose result is files, by asking Claude Code. */
export function claudeCodeTaskClassifier(options: AskOptions): TaskClassifier {
  return {
    assess: (task, signal) =>
      ask({
        ...options,
        instructions: TASK_CHECK_INSTRUCTIONS,
        data: taskAsData(task),
        schema: TASK_ASSESSMENT_JSON_SCHEMA,
        parse: (answer) => TaskAssessment.parse(answer),
        signal,
      }),
  };
}
