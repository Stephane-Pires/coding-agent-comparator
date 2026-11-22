import { RUN_REVIEW_INSTRUCTIONS, formatWork, type RunReviewer } from '@comparator/application';
import { RUN_REVIEW_JSON_SCHEMA, RunReview } from '@comparator/domain';

import { ask } from './ask.ts';

/** Reviews whether a run did its task, by asking Claude Code. */
export function createClaudeCodeRunReviewer(model: string): RunReviewer {
  return {
    review: (work, signal) =>
      ask({
        model,
        instructions: RUN_REVIEW_INSTRUCTIONS,
        data: formatWork(work),
        schema: RUN_REVIEW_JSON_SCHEMA,
        parse: (answer) => RunReview.parse(answer),
        signal,
      }),
  };
}
