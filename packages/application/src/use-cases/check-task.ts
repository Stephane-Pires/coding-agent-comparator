import { getVerdict, type Task, type TaskVerdict } from '@comparator/domain';

import type { TaskClassifier } from '../ports/task-classifier.ts';

/** Says whether the agents may run a task. Aborting the signal abandons the check. */
export type CheckTask = (task: Task, signal: AbortSignal) => Promise<TaskVerdict>;

/** How many verdicts are kept: enough for the runs of a comparison to find theirs, small enough to forget. */
const MAX_REMEMBERED_TASKS = 200;

/**
 * Says whether the agents may run a task: only a coding task whose result is files (the rule is `getVerdict`).
 *
 * The check is a filter, not a lock: when the classifier cannot answer, the task is accepted, so that a model that
 * is down or slow never stops the product.
 *
 * A verdict is remembered: a comparison asks once before it starts, then each of its runs asks again, and only the
 * first question reaches the model. An answer the classifier could not give is not remembered.
 */
export function checkTask(classifier: TaskClassifier): CheckTask {
  const remembered = new Map<Task, TaskVerdict>();
  return async (task, signal) => {
    const known = remembered.get(task);
    if (known) return known;
    try {
      const verdict = getVerdict(await classifier.assess(task, signal));
      // The oldest goes first: a Map keeps the order its keys were added in.
      if (remembered.size >= MAX_REMEMBERED_TASKS) remembered.delete(remembered.keys().next().value ?? task);
      remembered.set(task, verdict);
      return verdict;
    } catch {
      return { verdict: 'accepted' };
    }
  };
}
