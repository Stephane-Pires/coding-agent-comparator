import { getReviewedOutcome, type RunOutcome } from '@comparator/domain';

import type { RunReviewer, RunWork } from '../ports/run-reviewer.ts';

/** Says how a run ended when its agent stopped without error. Aborting the signal abandons the review. */
export type ReviewRun = (work: RunWork, signal: AbortSignal) => Promise<RunOutcome>;

/**
 * Says how a run ended when its agent stopped without error: succeeded if it did its task, incomplete if not (the
 * rule is `getReviewedOutcome`).
 *
 * Like the task check, the review is a filter: when the reviewer cannot answer, the run keeps the benefit of the
 * doubt and counts as succeeded.
 */
export function reviewRun(reviewer: RunReviewer): ReviewRun {
  return async (work, signal) => {
    try {
      return getReviewedOutcome(await reviewer.review(work, signal));
    } catch {
      return { status: 'succeeded' };
    }
  };
}
