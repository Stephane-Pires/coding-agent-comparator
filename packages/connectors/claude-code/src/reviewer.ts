import { RUN_REVIEW_INSTRUCTIONS, workAsData, type RunReviewer } from '@comparator/application';
import { RUN_REVIEW_JSON_SCHEMA, RunReview } from '@comparator/domain';

import { ask, type AskOptions } from './ask.ts';

/** Reviews whether a run did its task, by asking Claude Code. */
export function claudeCodeRunReviewer(options: AskOptions): RunReviewer {
  return {
    review: (work, signal) =>
      ask({
        ...options,
        instructions: RUN_REVIEW_INSTRUCTIONS,
        data: workAsData(work),
        schema: RUN_REVIEW_JSON_SCHEMA,
        parse: (answer) => RunReview.parse(answer),
        signal,
      }),
  };
}
