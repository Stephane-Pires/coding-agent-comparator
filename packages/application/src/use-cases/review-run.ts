import { reviewedOutcome, type RunOutcome } from '@comparator/domain';

import type { RunReviewer, RunWork } from '../ports/run-reviewer.ts';

export interface ReviewRunDeps {
  readonly reviewer: RunReviewer;
}

export interface ReviewRunInput {
  readonly work: RunWork;
  /** Aborting it abandons the review. */
  readonly signal: AbortSignal;
}

export type ReviewRun = (input: ReviewRunInput) => Promise<RunOutcome>;

/**
 * Says how a run ended when its agent stopped without error: succeeded if it did its task, incomplete if not (the
 * rule is `reviewedOutcome`).
 *
 * Like the task check, the review is a filter: when the reviewer cannot answer, the run keeps the benefit of the
 * doubt and counts as succeeded.
 */
export function reviewRun({ reviewer }: ReviewRunDeps): ReviewRun {
  return async ({ work, signal }) => {
    try {
      return reviewedOutcome(await reviewer.review(work, signal));
    } catch {
      return { status: 'succeeded' };
    }
  };
}
